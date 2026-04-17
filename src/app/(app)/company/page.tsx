'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Building2, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleGuard } from '@/components/shared/role-guard';
import { companyService } from '@/services/company.service';
import { companyFormSchema, type CompanyFormValues } from '@/features/company/schemas';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import type { Company, User } from '@/types/api';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { sanitizeFormPayload } from '@/lib/sanitize-payload';
import { maskPhoneBR } from '@/lib/br-masks';
import { PhotoUpload } from '@/components/shared/photo-upload';

/**
 * Picks the right entity off the `/me` response based on the user's role,
 * mirroring shieldgo-admin-web `RegisterData.vue`:
 *   SUPER_ADMIN_MASTER/SUPER_ADMIN → company
 *   ADMIN                          → account
 *   MANAGER                        → client
 *   OPERATOR                       → site
 */
function pickOwnEntity(me: User | undefined | null): Company | null {
  if (!me) return null;
  const subtype = me.companyUser?.subtype;
  const anyMe = me as unknown as {
    company?: Company;
    account?: Company;
    client?: Company;
    site?: Company;
  };
  if (subtype === 'SUPER_ADMIN_MASTER') {
    return anyMe.company ?? anyMe.account ?? null;
  }
  if (subtype === 'ADMIN_MASTER' || subtype === 'ADMIN') return anyMe.account ?? null;
  if (subtype === 'MANAGER') return anyMe.client ?? anyMe.account ?? null;
  if (subtype === 'OPERATOR' || subtype === 'AUDITOR') {
    return anyMe.site ?? anyMe.client ?? anyMe.account ?? null;
  }
  return anyMe.account ?? null;
}

export default function CompanyPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => companyService.getMe(),
    staleTime: 60 * 1000,
  });

  const company = useMemo(() => pickOwnEntity(meQuery.data?.result), [meQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useAppForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      fantasyName: '',
      document: '',
      email: '',
      primaryPhone: '',
      secondaryPhone: '',
      logoURL: '',
      status: 'ACTIVE',
      type: 'ACCOUNT',
      address: {
        cep: '',
        address: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        country: 'BR',
        ibge: '',
        gia: '',
        name: 'MAIN',
      },
    },
  });

  // Hydrate the form once the /me response lands
  useEffect(() => {
    if (!company) return;
    const extras = company as unknown as { secondaryPhone?: string; timezone?: string };
    reset({
      _id: company._id,
      name: company.name ?? '',
      fantasyName: company.fantasyName ?? '',
      personType: (company.personType ?? undefined) as 'LEGAL' | 'PHYSICAL' | undefined,
      document: company.document ?? '',
      email: company.email ?? '',
      primaryPhone: company.primaryPhone ?? '',
      secondaryPhone: extras.secondaryPhone ?? '',
      timezone: extras.timezone ?? '',
      logoURL: company.logoURL ?? '',
      status: company.status ?? 'ACTIVE',
      type: company.type ?? 'ACCOUNT',
      address: {
        cep: company.address?.cep ?? '',
        address: company.address?.address ?? '',
        number: company.address?.number ?? '',
        complement: company.address?.complement ?? '',
        neighborhood: company.address?.neighborhood ?? '',
        city: company.address?.city ?? '',
        state: company.address?.state ?? '',
        country: company.address?.country ?? 'BR',
        ibge: company.address?.ibge ?? '',
        gia: company.address?.gia ?? '',
        name: company.address?.name ?? 'MAIN',
      },
    });
  }, [company, reset]);

  const cep = useCepLookup(setValue, 'address');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (values: CompanyFormValues) => {
      if (!company) throw new Error('No company loaded');
      // Strip empty-string ObjectId refs + normalize masked phone/document fields.
      const sanitized = sanitizeFormPayload(values as unknown as Record<string, unknown>);
      return companyService.update(company._id, sanitized as never, logoFile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      // Editing the company (ACCOUNT) can ripple into every downstream lookup
      // (its clients, sites, equipment). Invalidate the whole tree.
      invalidateHierarchyAfter(queryClient, 'account');
      setLogoFile(null);
      toast.success(t('company.updateSuccess'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!company) {
    return <div className="text-text-secondary text-center py-20">{t('common.noData')}</div>;
  }

  return (
    <RoleGuard
      roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}
    >
      <div className="space-y-6">
        <PageHeader title={t('company.title')} description={t('company.companyInfo')} />

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-500" />
                {t('company.companyInfo')}
              </CardTitle>
              <CardDescription>{t('company.editCompany')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <PhotoUpload
                  value={logoFile}
                  previewUrl={watch('logoURL')}
                  onChange={(file) => {
                    setLogoFile(file);
                    if (!file) setValue('logoURL', '');
                  }}
                  label={t('common.logo')}
                  shape="rect"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('company.companyName')}</Label>
                <Input {...register('name')} />
                {errors.name && (
                  <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('company.fantasyName')}</Label>
                <Input {...register('fantasyName')} />
              </div>
              <div className="space-y-2">
                <Label>{t('company.personType')}</Label>
                <Controller
                  control={control}
                  name="personType"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEGAL">{t('company.legal')}</SelectItem>
                        <SelectItem value="PHYSICAL">{t('company.physical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('company.document')}</Label>
                <Input {...register('document')} />
              </div>
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input type="email" {...register('email')} />
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
                <Label>{t('company.secondaryPhone')}</Label>
                <Input
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  value={maskPhoneBR(watch('secondaryPhone') ?? '')}
                  onChange={(e) =>
                    setValue('secondaryPhone', e.target.value.replace(/\D/g, ''), {
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
                    <Select value={field.value ?? 'ACTIVE'} onValueChange={field.onChange}>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('common.address')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              <Save className="h-4 w-4" />
              {isSubmitting || mutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
