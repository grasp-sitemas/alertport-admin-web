'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
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
import type { Company } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Company;
}

export function SiteFormDialog({ open, onOpenChange, site }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!site;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: site
      ? {
          _id: site._id,
          name: site.name,
          account:
            typeof site.account === 'object'
              ? site.account?._id
              : (site.account as string | undefined),
          client:
            typeof site.client === 'object'
              ? (site.client?._id ?? '')
              : ((site.client as string | undefined) ?? ''),
          primaryPhone: site.primaryPhone,
          owner: '',
          enableFreePatrol: false,
          address: site.address ?? DEFAULT_SITE_VALUES.address,
          type: 'SITE',
          status: site.status,
        }
      : DEFAULT_SITE_VALUES,
  });

  const accountWatched = useWatch({ control, name: 'account' });
  const clientsLookup = useClientsLookup(accountWatched || undefined);

  const lookupCepMutation = useMutation({
    mutationFn: (cep: string) => helpersService.lookupCep(cep),
    onSuccess: (data) => {
      if (data.erro) {
        toast.error(t('sites.cepInvalid'));
        return;
      }
      if (data.logradouro) setValue('address.address', data.logradouro);
      if (data.bairro) setValue('address.neighborhood', data.bairro);
      if (data.localidade) setValue('address.city', data.localidade);
      if (data.uf) setValue('address.state', data.uf);
      if (data.ibge) setValue('address.ibge', data.ibge);
      if (data.gia) setValue('address.gia', data.gia);
    },
    onError: () => toast.error(t('sites.cepInvalid')),
  });

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
      if (isEdit && site) return companyService.update(site._id, payload);
      return companyService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
              <Input {...register('primaryPhone')} />
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

            <div className="space-y-2 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-white/5"
                  {...register('enableFreePatrol')}
                />
                {t('sites.enableFreePatrol')}
              </label>
            </div>
          </div>

          <div className="h-px bg-white/10 my-2" />

          <h4 className="text-sm font-semibold text-white">{t('common.address')}</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('sites.cep')}</Label>
              <div className="flex gap-2">
                <Input {...register('address.cep')} placeholder="00000-000" />
                <Controller
                  control={control}
                  name="address.cep"
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => field.value && lookupCepMutation.mutate(field.value)}
                      disabled={!field.value || lookupCepMutation.isPending}
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
