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
import { clientFormSchema, type ClientFormValues, DEFAULT_CLIENT_VALUES } from './schemas';
import { companyService } from '@/services/company.service';
import { useAccountsLookup } from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { maskPhoneBR } from '@/lib/br-masks';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import type { Company } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Company;
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

export function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!client;
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const accountsLookup = useAccountsLookup();

  const defaults: ClientFormValues = client
    ? {
        _id: client._id,
        name: client.name ?? '',
        email: client.email || '',
        primaryPhone: (client.primaryPhone ?? '').replace(/\D/g, ''),
        owner: (client as unknown as { owner?: string }).owner ?? '',
        account:
          typeof client.account === 'object'
            ? (client.account?._id ?? '')
            : ((client.account as string | undefined) ?? ''),
        type: 'CLIENT',
        status: client.status ?? 'ACTIVE',
      }
    : {
        ...DEFAULT_CLIENT_VALUES,
        account: canSelectAccount ? '' : (sessionAccountId ?? ''),
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useAppForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?._id]);

  const mutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      // Strip empty optional fields so Mongoose doesn't try to cast "" to
      // ObjectId refs (account) or email-validate empty strings.
      const sanitized: Record<string, unknown> = {
        name: data.name,
        type: 'CLIENT' as const,
        status: data.status,
        account: data.account,
      };
      if (data.email && data.email.trim()) sanitized.email = data.email.trim();
      if (data.primaryPhone && data.primaryPhone.trim()) {
        sanitized.primaryPhone = data.primaryPhone.replace(/\D/g, '');
      }
      if (data.owner && data.owner.trim()) sanitized.owner = data.owner.trim();

      if (isEdit && client) {
        return companyService.update(client._id, sanitized);
      }
      return companyService.create(sanitized as never);
    },
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'client');
      toast.success(isEdit ? t('clients.updateSuccess') : t('clients.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorBody>) => {
      // Surface backend validation details when available - the generic
      // "Ocorreu um erro. Tente novamente." gives no hint of WHICH field
      // is missing.
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
          <DialogTitle>{isEdit ? t('clients.editClient') : t('clients.createClient')}</DialogTitle>
          <DialogDescription>{t('clients.clientDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canSelectAccount && (
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  {t('common.account')}
                  <span className="text-red-400 ml-0.5">*</span>
                </Label>
                <Controller
                  control={control}
                  name="account"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
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
                {errors.account && (
                  <p className="text-xs text-red-400">{t(errors.account.message as string)}</p>
                )}
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {t('common.name')}
                <span className="text-red-400 ml-0.5">*</span>
              </Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
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
            <div className="space-y-2">
              <Label>{t('clients.owner')}</Label>
              <Input {...register('owner')} />
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
