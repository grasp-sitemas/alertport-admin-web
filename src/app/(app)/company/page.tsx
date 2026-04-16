'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Building2 } from 'lucide-react';
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
import { useAuth } from '@/hooks/use-auth';
import { companyService } from '@/services/company.service';
import { companyFormSchema, type CompanyFormValues } from '@/features/company/schemas';

export default function CompanyPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const companyId =
    typeof user?.account === 'object'
      ? user.account._id
      : typeof user?.account === 'string'
        ? user.account
        : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => (companyId ? companyService.getById(companyId) : null),
    enabled: !!companyId,
  });

  const company = data?.result;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    values: company
      ? {
          _id: company._id,
          name: company.name,
          fantasyName: company.fantasyName,
          personType: company.personType,
          document: company.document,
          email: company.email || '',
          primaryPhone: company.primaryPhone,
          status: company.status,
          address: company.address || {},
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: CompanyFormValues) => {
      if (!company) throw new Error('No company loaded');
      return companyService.update(company._id, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success(t('company.updateSuccess'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-text-secondary text-center py-20">{t('common.noData')}</div>
    );
  }

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <div className="space-y-6">
        <PageHeader title={t('company.title')} description={t('company.companyInfo')} />

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-500" />
                {t('company.companyInfo')}
              </CardTitle>
              <CardDescription>{t('company.editCompany')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input {...register('primaryPhone')} />
              </div>
              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
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
                <Label>CEP</Label>
                <Input {...register('address.cep')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('common.address')}</Label>
                <Input {...register('address.address')} />
              </div>
              <div className="space-y-2">
                <Label>Nº</Label>
                <Input {...register('address.number')} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input {...register('address.complement')} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input {...register('address.neighborhood')} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input {...register('address.city')} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input {...register('address.state')} />
              </div>
              <div className="space-y-2">
                <Label>País</Label>
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
