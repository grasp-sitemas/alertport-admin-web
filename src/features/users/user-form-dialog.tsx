'use client';

import { useEffect } from 'react';
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
import { userFormSchema, type UserFormValues, DEFAULT_USER_VALUES } from './schemas';
import { usersService, type AdminUserFormData } from '@/services/users.service';
import { ROLES, isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
} from '@/features/shared/use-hierarchy-lookups';
import type { User } from '@/types/api';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}

function getIdOrEmpty(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '_id' in v) {
    const id = (v as { _id?: unknown })._id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!user;
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const defaults: UserFormValues = user
    ? {
        _id: user._id,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        oldEmail: user.email ?? '',
        username: user.username ?? '',
        oldUsername: user.username ?? '',
        primaryPhone: user.primaryPhone ?? '',
        photoURL: user.photoURL ?? '',
        account: getIdOrEmpty(user.account),
        client: getIdOrEmpty(user.client),
        site: getIdOrEmpty(user.site),
        status: user.status ?? 'ACTIVE',
        companyUser: {
          subtype:
            (user.companyUser?.subtype as 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'AUDITOR') ||
            'OPERATOR',
          status: user.companyUser?.status || 'ACTIVE',
        },
        address: {
          cep: user.address?.cep ?? '',
          address: user.address?.address ?? '',
          number: user.address?.number ?? '',
          complement: user.address?.complement ?? '',
          neighborhood: user.address?.neighborhood ?? '',
          city: user.address?.city ?? '',
          state: user.address?.state ?? '',
          country: user.address?.country ?? 'BR',
          ibge: user.address?.ibge ?? '',
          gia: user.address?.gia ?? '',
          name: user.address?.name ?? 'MAIN',
        },
      }
    : {
        ...DEFAULT_USER_VALUES,
        account: canSelectAccount ? '' : sessionAccountId || '',
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?._id]);

  const subtypeWatched = useWatch({ control, name: 'companyUser.subtype' });
  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined);

  const cep = useCepLookup(setValue, 'address');

  // Show client/site based on subtype
  const showClient = ['MANAGER', 'OPERATOR', 'AUDITOR'].includes(subtypeWatched ?? '');
  const showSite = ['OPERATOR', 'AUDITOR'].includes(subtypeWatched ?? '');

  const mutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const { confirmPassword: _c, ...rest } = data;
      void _c;
      const payload = {
        ...rest,
        oldEmail: rest.oldEmail ?? (isEdit ? rest.email : undefined),
        oldUsername: rest.oldUsername ?? (isEdit ? rest.username : undefined),
        type: 'USER-COMPANY' as const,
      };
      // Don't send password on edit if it was left empty
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      if (isEdit && user) {
        return usersService.update(user._id, payload as Partial<AdminUserFormData>);
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

  let prevAccount = defaults.account ?? '';
  let prevClient = defaults.client ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('users.editUser') : t('users.createUser')}</DialogTitle>
          <DialogDescription>{t('users.userDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('users.role')}</Label>
              <Controller
                control={control}
                name="companyUser.subtype"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Clear child fields when switching role
                      if (val === 'ADMIN') {
                        setValue('client', '');
                        setValue('site', '');
                      }
                      if (val === 'MANAGER') {
                        setValue('site', '');
                      }
                    }}
                  >
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
                    value={field.value ?? 'ACTIVE'}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue(
                        'companyUser.status',
                        val as 'ACTIVE' | 'ARCHIVED',
                      );
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
                        if (val !== prevAccount) {
                          setValue('client', '');
                          setValue('site', '');
                          prevAccount = val;
                        }
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

            {showClient && (
              <div className="space-y-2">
                <Label>{t('common.client')}</Label>
                <Controller
                  control={control}
                  name="client"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val !== prevClient) {
                          setValue('site', '');
                          prevClient = val;
                        }
                      }}
                    >
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
            )}

            {showSite && (
              <div className="space-y-2">
                <Label>{t('common.site')}</Label>
                <Controller
                  control={control}
                  name="site"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectOption')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(sitesLookup.data?.results ?? []).map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

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
              <Label>{t('collaborators.username')}</Label>
              <Input {...register('username')} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.phone')}</Label>
              <Input {...register('primaryPhone')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('common.email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {t('auth.password')}
                {isEdit ? ` (${t('common.optional')})` : ''}
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                {...register('password')}
                placeholder={isEdit ? '••••••••' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t('auth.password')} ({t('common.confirm')})
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-400">
                  {t(errors.confirmPassword.message as string)}
                </p>
              )}
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
