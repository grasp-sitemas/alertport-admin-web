'use client';

import { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { siteFormSchema, type SiteFormValues, DEFAULT_SITE_VALUES } from './schemas';
import { companyService } from '@/services/company.service';
import { helpersService } from '@/services/helpers.service';
import { useClientsLookup } from './use-clients-lookup';
import { useAccountsLookup } from '@/features/shared/use-hierarchy-lookups';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { sanitizeFormPayload } from '@/lib/sanitize-payload';
import { maskPhoneBR } from '@/lib/br-masks';
import type { Company } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Company;
}

export function SiteFormDialog({ open, onOpenChange, site }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!site;
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const defaults: SiteFormValues = site
    ? {
        _id: site._id,
        name: site.name ?? '',
        account:
          typeof site.account === 'object'
            ? (site.account?._id ?? '')
            : (site.account as string | undefined) ?? '',
        client:
          typeof site.client === 'object'
            ? (site.client?._id ?? '')
            : (site.client as string | undefined) ?? '',
        primaryPhone: (site.primaryPhone ?? '').replace(/\D/g, ''),
        owner: (site as unknown as { owner?: string }).owner ?? '',
        address: {
          cep: site.address?.cep ?? '',
          address: site.address?.address ?? '',
          number: site.address?.number ?? '',
          complement: site.address?.complement ?? '',
          neighborhood: site.address?.neighborhood ?? '',
          city: site.address?.city ?? '',
          state: site.address?.state ?? '',
          country: site.address?.country ?? 'BR',
          ibge: site.address?.ibge ?? '',
          gia: site.address?.gia ?? '',
          name: site.address?.name ?? 'MAIN',
        },
        type: 'SITE',
        status: site.status ?? 'ACTIVE',
      }
    : {
        ...DEFAULT_SITE_VALUES,
        account: canSelectAccount ? '' : sessionAccountId || '',
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useAppForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, site?._id]);

  const accountWatched = useWatch({ control, name: 'account' });
  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);

  const cep = useCepLookup(setValue, 'address');

  const saveMutation = useMutation({
    mutationFn: async (data: SiteFormValues) => {
      const payload = { ...data, type: 'SITE' as const };
      // Try geolocation (non-blocking — don't break save if geo fails)
      if (
        payload.address?.cep &&
        payload.address?.address &&
        payload.address?.number &&
        payload.address?.city
      ) {
        try {
          const geo = await helpersService.geolocate({
            cep: payload.address.cep,
            address: payload.address.address,
            number: payload.address.number,
            neighborhood: payload.address.neighborhood,
            city: payload.address.city,
            state: payload.address.state,
          });
          const loc = geo.results?.[0]?.geometry;
          const lat = loc?.location?.lat ?? loc?.lat;
          const lng = loc?.location?.lng ?? loc?.lng;
          if (typeof lat === 'number' && typeof lng === 'number') {
            payload.address.lat = lat;
            payload.address.lng = lng;
          }
        } catch {
          /* ignore — geolocation is optional */
        }
      }
      // Strip empty-string ObjectId refs + normalize masked fields before POST.
      const sanitized = sanitizeFormPayload(payload as unknown as Record<string, unknown>);
      if (isEdit && site) return companyService.update(site._id, sanitized as never);
      return companyService.create(sanitized as never);
    },
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'site');
      toast.success(isEdit ? t('sites.updateSuccess') : t('sites.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('sites.editSite') : t('sites.createSite')}</DialogTitle>
          <DialogDescription>{t('sites.siteDetails')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canSelectAccount && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('common.account')}</Label>
                <Controller
                  control={control}
                  name="account"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Clear client when account changes (cascade)
                        setValue('client', '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectOption')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(accountsLookup.data?.results ?? []).map((a) => (
                          <SelectItem key={a._id} value={a._id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label>{t('common.name')}</Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('common.client')}</Label>
              <Controller
                control={control}
                name="client"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientsLookup.data?.results ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client && (
                <p className="text-xs text-red-400">{t(errors.client.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('common.phone')}</Label>
              <Input
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                maxLength={16}
                value={maskPhoneBR(watch('primaryPhone') ?? '')}
                onChange={(e) =>
                  setValue('primaryPhone', e.target.value.replace(/\D/g, ''), {
                    shouldValidate: false,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('common.active')}</SelectItem>
                      <SelectItem value="ARCHIVED">{t('common.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

          </div>

          <div className="h-px bg-white/10 my-2" />

          <h4 className="text-sm font-semibold text-white">{t('common.address')}</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('sites.cep')}</Label>
              <div className="flex gap-2">
                <Controller
                  control={control}
                  name="address.cep"
                  render={({ field }) => (
                    <Input
                      value={field.value ?? ''}
                      placeholder="00000-000"
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        cep.lookupIfComplete(e.target.value);
                      }}
                      onBlur={(e) => cep.lookupIfComplete(e.target.value)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="address.cep"
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => field.value && cep.lookup(field.value)}
                      disabled={!field.value || cep.isLoading}
                      aria-label={t('common.search')}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  )}
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('sites.street')}</Label>
              <Input {...register('address.address')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.number')}</Label>
              <Input {...register('address.number')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.complement')}</Label>
              <Input {...register('address.complement')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.neighborhood')}</Label>
              <Input {...register('address.neighborhood')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.city')}</Label>
              <Input {...register('address.city')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.state')}</Label>
              <Input {...register('address.state')} />
            </div>
            <div className="space-y-2">
              <Label>{t('sites.country')}</Label>
              <Input {...register('address.country')} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || saveMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
              {isSubmitting || saveMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
