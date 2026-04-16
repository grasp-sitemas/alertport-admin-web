'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import type { Company } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Company;
}

export function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!client;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client
      ? {
          _id: client._id,
          name: client.name,
          email: client.email || '',
          primaryPhone: client.primaryPhone,
          account:
            typeof client.account === 'object'
              ? client.account?._id
              : (client.account as string | undefined),
          type: 'CLIENT',
          status: client.status,
          owner: '',
        }
      : DEFAULT_CLIENT_VALUES,
  });

  const mutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const payload = { ...data, type: 'CLIENT' as const };
      if (isEdit && client) return companyService.update(client._id, payload);
      return companyService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(isEdit ? t('clients.updateSuccess') : t('clients.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('clients.editClient') : t('clients.createClient')}</DialogTitle>
          <DialogDescription>{t('clients.clientDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('common.name')}</Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('common.email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('common.phone')}</Label>
              <Input {...register('primaryPhone')} />
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
