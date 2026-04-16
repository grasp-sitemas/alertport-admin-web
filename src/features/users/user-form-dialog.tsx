'use client';

import { useEffect } from 'react';
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
import { userFormSchema, type UserFormValues, DEFAULT_USER_VALUES } from './schemas';
import { usersService, type AdminUserFormData } from '@/services/users.service';
import { ROLES } from '@/config/roles';
import type { User } from '@/types/api';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const defaults: UserFormValues = user
    ? {
        _id: user._id,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        username: user.username ?? '',
        primaryPhone: user.primaryPhone ?? '',
        status: user.status ?? 'ACTIVE',
        companyUser: {
          subtype:
            (user.companyUser?.subtype as 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'AUDITOR') ||
            'OPERATOR',
          status: user.companyUser?.status || 'ACTIVE',
        },
      }
    : DEFAULT_USER_VALUES;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: defaults,
  });

  // React Hook Form only reads defaultValues once. When the dialog is opened
  // to edit a different target we have to reset the form manually; otherwise
  // fields would show the previous user's values (or be empty on first open).
  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?._id]);

  const mutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const { confirmPassword, ...rest } = data;
      void confirmPassword;
      const payload = {
        ...rest,
        type: 'USER-COMPANY' as const,
      } satisfies Partial<AdminUserFormData>;
      if (isEdit && user) {
        return usersService.update(user._id, payload);
      }
      return usersService.create(payload as AdminUserFormData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isEdit ? t('users.updateSuccess') : t('users.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const onSubmit = (data: UserFormValues) => mutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('users.editUser') : t('users.createUser')}</DialogTitle>
          <DialogDescription>{t('users.userDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('users.firstName')}</Label>
              <Input {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-red-400">{t(errors.firstName.message as string)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('users.lastName')}</Label>
              <Input {...register('lastName')} />
              {errors.lastName && (
                <p className="text-xs text-red-400">{t(errors.lastName.message as string)}</p>
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
              <Label>{t('users.role')}</Label>
              <Controller
                control={control}
                name="companyUser.subtype"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {t(role.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                    }}
                  >
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
            {!isEdit && (
              <>
                <div className="space-y-2">
                  <Label>{t('auth.password')}</Label>
                  <Input type="password" {...register('password')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('auth.password')} ({t('common.confirm')})</Label>
                  <Input type="password" {...register('confirmPassword')} />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-400">
                      {t(errors.confirmPassword.message as string)}
                    </p>
                  )}
                </div>
              </>
            )}
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
