'use client';

import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
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
import {
  companyListFormSchema,
  type CompanyListFormValues,
  DEFAULT_COMPANY_LIST_VALUES,
} from './schemas';
import { companyService } from '@/services/company.service';
import { auditLogService } from '@/services/audit-log.service';
import { maskPhoneBR } from '@/lib/br-masks';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import type { Company } from '@/types/api';
import {
  TimezoneSelect,
  detectBrowserTimezone,
} from '@/components/shared/timezone-select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}

interface ApiErrorItem {
  id?: string;
  text?: string;
}
interface ApiErrorBody {
  messageId?: string;
  message?: string;
  errors?: ApiErrorItem[];
}

export function CompanyListFormDialog({ open, onOpenChange, company }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!company;

  const defaults: CompanyListFormValues = company
    ? {
        _id: company._id,
        name: company.name ?? '',
        fantasyName: company.fantasyName ?? '',
        personType: (company.personType ?? undefined) as 'LEGAL' | 'PHYSICAL' | undefined,
        document: company.document ?? '',
        email: company.email ?? '',
        primaryPhone: (company.primaryPhone ?? '').replace(/\D/g, ''),
        // Pre-fill new rows with the operator's browser timezone — most
        // accounts onboard from the same market as the SUPER_ADMIN
        // editing them, so it's a better default than leaving blank.
        timezone: company.timezone ?? '',
        type: 'ACCOUNT',
        status: company.status ?? 'ACTIVE',
      }
    : { ...DEFAULT_COMPANY_LIST_VALUES, timezone: detectBrowserTimezone() };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useAppForm<CompanyListFormValues>({
    resolver: zodResolver(companyListFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company?._id]);

  const mutation = useMutation({
    mutationFn: async (data: CompanyListFormValues) => {
      const sanitized: Record<string, unknown> = {
        name: data.name,
        type: 'ACCOUNT' as const,
        status: data.status,
      };
      if (data.fantasyName && data.fantasyName.trim()) {
        sanitized.fantasyName = data.fantasyName.trim();
      }
      if (data.personType) sanitized.personType = data.personType;
      if (data.document && data.document.trim()) sanitized.document = data.document.trim();
      if (data.email && data.email.trim()) sanitized.email = data.email.trim();
      if (data.primaryPhone && data.primaryPhone.trim()) {
        sanitized.primaryPhone = data.primaryPhone.replace(/\D/g, '');
      }
      if (data.timezone && data.timezone.trim()) {
        sanitized.timezone = data.timezone.trim();
      }

      if (isEdit && company) {
        return companyService.update(company._id, sanitized);
      }
      return companyService.create(sanitized as never);
    },
    onSuccess: (response) => {
      invalidateHierarchyAfter(queryClient, 'account');
      toast.success(isEdit ? t('companies.updateSuccess') : t('companies.createSuccess'));
      // Only COMPANY_UPDATED exists in the backend audit enum; skip capture on create.
      if (isEdit) {
        const saved = (response as { result?: { _id?: string; name?: string } })?.result;
        void auditLogService.capture({
          action: 'COMPANY_UPDATED',
          domain: 'COMPANY',
          resourceId: saved?._id || company?._id,
          resourceLabel: saved?.name || undefined,
        });
      }
      onOpenChange(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorBody>) => {
      const body = err.response?.data;
      const detail =
        body?.errors?.[0]?.text ||
        body?.errors?.[0]?.id ||
        body?.message ||
        body?.messageId;
      toast.error(t('notifications.errorOccurred'), {
        description: detail ?? undefined,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('companies.editCompany') : t('companies.createCompany')}
          </DialogTitle>
          <DialogDescription>{t('companies.companyDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {t('company.companyName')}
                <span className="text-red-400 ml-0.5">*</span>
              </Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
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
                      <SelectValue placeholder={t('common.selectOption')} />
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
              <Input type="email" {...register('email')} placeholder="nome@empresa.com" />
              {errors.email && (
                <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-list-timezone">{t('company.timezone')}</Label>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <TimezoneSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    datalistId={
                      isEdit
                        ? `company-list-tz-edit-${company?._id ?? 'x'}`
                        : 'company-list-tz-create'
                    }
                    name={field.name}
                  />
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
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
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || mutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
