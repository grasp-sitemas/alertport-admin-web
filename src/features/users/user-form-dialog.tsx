'use client';

import { useEffect, useState } from 'react';
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
import { userFormSchema, type UserFormValues, DEFAULT_USER_VALUES } from './schemas';
import { usersService, type AdminUserFormData } from '@/services/users.service';
import { isTrialError, toastTrialError } from '@/components/trial/trial-error-toast';
import { ROLES, isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { sanitizeFormPayload } from '@/lib/sanitize-payload';
import { maskPhoneBR } from '@/lib/br-masks';
import { PasswordField } from '@/components/shared/password-field';
import { PhotoUpload } from '@/components/shared/photo-upload';
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

/**
 * If the user row already carries a populated account/client/site object
 * (id + name), return it as a { _id, name } tuple so we can force it into
 * the Select options. Returns null if the field is a bare string id or
 * missing.
 */
function extractLookupOption(v: unknown): { _id: string; name: string } | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as { _id?: unknown; name?: unknown };
  const id = typeof obj._id === 'string' ? obj._id : '';
  const name = typeof obj.name === 'string' ? obj.name : '';
  if (!id) return null;
  return { _id: id, name: name || id };
}

/**
 * Merge an optional "preferred" option into a list of lookup results. Used
 * so that the Account/Client/Site <Select> always has a SelectItem matching
 * the current form value - critical for edit mode, since Radix Select only
 * renders the trigger label when a matching child is mounted. Without this,
 * the trigger shows the placeholder until the lookup query resolves (and
 * stays empty forever if the item isn't in the first page of results or if
 * it's archived and therefore filtered out server-side).
 */
function mergeOption<T extends { _id: string; name: string }>(
  list: T[],
  preferred: { _id: string; name: string } | null,
): Array<{ _id: string; name: string }> {
  if (!preferred) return list;
  if (list.some((item) => item._id === preferred._id)) return list;
  return [preferred, ...list];
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
    watch,
    formState: { errors, isSubmitting },
  } = useAppForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: defaults,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      // `reset(defaults)` reinitializes the whole form so every field -
      // including the hierarchy triad - picks up the new user's values.
      // Without `keepDefaultValues: false` (the default) RHF also swaps its
      // internal `defaultValues`, which avoids "dirty" state lingering from
      // a previous edit session.
      reset(defaults);
      setPhotoFile(null);

      // Belt-and-suspenders: explicitly push account/client/site once more
      // on the next tick. In practice the reset above is enough, but if a
      // downstream controller (e.g. the account Select's `onValueChange`
      // handler running on the first render after reset) happens to clear
      // client/site by comparing against the stale `prevAccount` closure,
      // this ensures the final state still matches the user being edited.
      if (user) {
        const accountId = getIdOrEmpty(user.account);
        const clientId = getIdOrEmpty(user.client);
        const siteId = getIdOrEmpty(user.site);
        queueMicrotask(() => {
          if (accountId) setValue('account', accountId, { shouldDirty: false });
          if (clientId) setValue('client', clientId, { shouldDirty: false });
          if (siteId) setValue('site', siteId, { shouldDirty: false });
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?._id]);

  const subtypeWatched = useWatch({ control, name: 'companyUser.subtype' });
  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined);

  // When editing, the user row ships the hierarchy embedded (account, client,
  // site as { _id, name, ... } objects). Merge those into the Select options
  // so the trigger always finds a matching SelectItem and displays the name
  // even before the lookup queries resolve - or when the referenced entity
  // is archived/out-of-page and therefore absent from the active list.
  const accountOptions = mergeOption(
    accountsLookup.data?.results ?? [],
    extractLookupOption(user?.account),
  );
  const clientOptions = mergeOption(
    clientsLookup.data?.results ?? [],
    extractLookupOption(user?.client),
  );
  const siteOptions = mergeOption(
    sitesLookup.data?.results ?? [],
    extractLookupOption(user?.site),
  );

  const cep = useCepLookup(setValue, 'address');

  // Show client/site based on subtype
  const showClient = ['MANAGER', 'OPERATOR', 'AUDITOR'].includes(subtypeWatched ?? '');
  const showSite = ['OPERATOR', 'AUDITOR'].includes(subtypeWatched ?? '');

  const mutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const { confirmPassword: _c, ...rest } = data;
      void _c;
      const payload: Record<string, unknown> = {
        ...rest,
        oldEmail: rest.oldEmail ?? (isEdit ? rest.email : undefined),
        oldUsername: rest.oldUsername ?? (isEdit ? rest.username : undefined),
        type: 'USER-COMPANY',
      };
      // Don't send password on edit if it was left empty
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      // Strip empty strings / nulls so Mongoose doesn't try to cast "" into
      // ObjectId refs (site/client/account), email validators, etc. Also
      // normalizes primaryPhone / cep / document down to digits-only.
      const sanitized = sanitizeFormPayload(payload) as unknown;
      if (isEdit && user) {
        return usersService.update(user._id, sanitized as Partial<AdminUserFormData>, photoFile);
      }
      return usersService.create(sanitized as AdminUserFormData, photoFile);
    },
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'user');
      toast.success(isEdit ? t('users.updateSuccess') : t('users.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: (err) => {
      if (isTrialError(err)) {
        toastTrialError(err, t);
        return;
      }
      // Empty file selections (mobile emulator bug) throw a specific error
      // from the multipart helper. Show a clear copy instead of the generic
      // "Ocorreu um erro" toast.
      if ((err as Error)?.message === 'empty.file.upload') {
        toast.error(t('common.fileEmpty'));
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
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
          <PhotoUpload
            value={photoFile}
            previewUrl={watch('photoURL')}
            onChange={(file) => {
              setPhotoFile(file);
              if (!file) setValue('photoURL', '');
            }}
            label={t('common.photo')}
            shape="circle"
          />

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
                        {accountOptions.map((a) => (
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
                        {clientOptions.map((c) => (
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
                        {siteOptions.map((s) => (
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
              <Label>{t('common.email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <PasswordField
                label={`${t('auth.password')}${isEdit ? ` (${t('common.optional')})` : ''}`}
                value={watch('password') ?? ''}
                onChange={(e) =>
                  setValue('password', e.target.value, { shouldValidate: false })
                }
                placeholder={isEdit ? '••••••••' : undefined}
                showPolicy={!isEdit || !!(watch('password') ?? '').length}
                error={
                  errors.password
                    ? t(errors.password.message as string)
                    : undefined
                }
              />
            </div>
            <div className="sm:col-span-2">
              <PasswordField
                label={`${t('auth.password')} (${t('common.confirm')})`}
                value={watch('confirmPassword') ?? ''}
                onChange={(e) =>
                  setValue('confirmPassword', e.target.value, { shouldValidate: false })
                }
                error={
                  errors.confirmPassword
                    ? t(errors.confirmPassword.message as string)
                    : undefined
                }
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
