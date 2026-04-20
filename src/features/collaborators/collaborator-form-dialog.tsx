'use client';

import { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
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
import {
  collaboratorFormSchema,
  type CollaboratorFormValues,
  DEFAULT_COLLABORATOR_VALUES,
} from './schemas';
import { usersService } from '@/services/users.service';
import type { User } from '@/types/api';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { sanitizeFormPayload } from '@/lib/sanitize-payload';
import { maskPhoneBR } from '@/lib/br-masks';
import { PasswordField } from '@/components/shared/password-field';
import { PhotoUpload } from '@/components/shared/photo-upload';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator?: User;
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

export function CollaboratorFormDialog({ open, onOpenChange, collaborator }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!collaborator;
  const canSelectAccount = isSuperAdminMaster(userSubtype);

  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const defaults: CollaboratorFormValues = collaborator
    ? {
        _id: collaborator._id,
        firstName: collaborator.firstName,
        lastName: collaborator.lastName,
        email: collaborator.email || '',
        oldEmail: collaborator.email || '',
        username: collaborator.username || '',
        oldUsername: collaborator.username || '',
        primaryPhone: collaborator.primaryPhone || '',
        photoURL: collaborator.photoURL || '',
        password: '',
        account: getIdOrEmpty(collaborator.account),
        client: getIdOrEmpty(collaborator.client),
        site: getIdOrEmpty(collaborator.site),
        customerUser: {
          subtype: (collaborator.customerUser?.subtype ?? 'VIGILANT') as 'VIGILANT' | 'SUPERVISOR',
          status: collaborator.customerUser?.status ?? collaborator.status ?? 'ACTIVE',
          employeeCode: collaborator.customerUser?.employeeCode,
        },
        address: {
          cep: collaborator.address?.cep || '',
          address: collaborator.address?.address || '',
          number: collaborator.address?.number || '',
          complement: collaborator.address?.complement || '',
          neighborhood: collaborator.address?.neighborhood || '',
          city: collaborator.address?.city || '',
          state: collaborator.address?.state || '',
          name: collaborator.address?.name || 'MAIN',
        },
        type: 'USER-CUSTOMER',
        status: collaborator.status || 'ACTIVE',
      }
    : {
        ...DEFAULT_COLLABORATOR_VALUES,
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
  } = useAppForm<CollaboratorFormValues>({
    resolver: zodResolver(collaboratorFormSchema),
    defaultValues: defaults,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // When the dialog opens for a new/edit target, reset to those values
  useEffect(() => {
    if (open) {
      reset(defaults);
      setPhotoFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collaborator?._id]);

  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });
  const cep = useCepLookup(setValue, 'address');

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined);

  // Cascade resets when parent changes
  const previousAccountRef = { current: defaults.account };
  const previousClientRef = { current: defaults.client };

  // Using simple onChange handlers in the Controllers below to clear children.

  const mutation = useMutation({
    mutationFn: async (data: CollaboratorFormValues) => {
      // Server-side uniqueness checks (legacy behavior)
      const resEmail = await usersService.checkEmailExists(data.email);
      if (
        resEmail.alreadyExist &&
        (!data._id || (data._id && resEmail._id && resEmail._id !== data._id))
      ) {
        throw new Error('email');
      }
      const resUsername = await usersService.checkUsernameExists(data.username);
      if (
        resUsername.alreadyExist &&
        (!data._id || (data._id && resUsername._id && resUsername._id !== data._id))
      ) {
        throw new Error('username');
      }

      const payload: Record<string, unknown> = {
        ...data,
        type: 'USER-CUSTOMER',
        oldEmail: data.oldEmail ?? (isEdit ? data.email : undefined),
        oldUsername: data.oldUsername ?? (isEdit ? data.username : undefined),
      };
      // On edit, don't send empty password (legacy ignores it too)
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      // Strip empty-string ObjectId refs (site/client/account) so Mongoose
      // doesn't blow up on cast + normalize phone/CEP/document digits.
      const sanitized = sanitizeFormPayload(payload) as unknown;
      if (isEdit && collaborator) {
        return usersService.updateCollaborator(
          collaborator._id,
          sanitized as Parameters<typeof usersService.updateCollaborator>[1],
          photoFile,
        );
      }
      return usersService.createCollaborator(
        sanitized as Parameters<typeof usersService.createCollaborator>[0],
        photoFile,
      );
    },
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'user');
      toast.success(isEdit ? t('collaborators.updateSuccess') : t('collaborators.createSuccess'));
      onOpenChange(false);
      reset(DEFAULT_COLLABORATOR_VALUES);
    },
    onError: (err: Error) => {
      if (err.message === 'email') toast.error(t('collaborators.emailInUse'));
      else if (err.message === 'username') toast.error(t('collaborators.usernameInUse'));
      else if (err.message === 'empty.file.upload') toast.error(t('common.fileEmpty'));
      else toast.error(t('notifications.errorOccurred'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('collaborators.editCollaborator') : t('collaborators.createCollaborator')}
          </DialogTitle>
          <DialogDescription>{t('collaborators.collaboratorDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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
            {/* Subtype */}
            <div className="space-y-2">
              <Label>{t('collaborators.type')}</Label>
              <Controller
                control={control}
                name="customerUser.subtype"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIGILANT">{t('collaborators.vigilant')}</SelectItem>
                      <SelectItem value="SUPERVISOR">{t('collaborators.supervisor')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Status */}
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
                        'customerUser.status',
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
                        if (val !== previousAccountRef.current) {
                          setValue('client', '');
                          setValue('site', '');
                          previousAccountRef.current = val;
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
                {errors.account && (
                  <p className="text-xs text-red-400">{t(errors.account.message as string)}</p>
                )}
              </div>
            )}

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
                      if (val !== previousClientRef.current) {
                        setValue('site', '');
                        previousClientRef.current = val;
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
              {errors.site && (
                <p className="text-xs text-red-400">{t(errors.site.message as string)}</p>
              )}
            </div>

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
              <Label>{t('collaborators.username')}</Label>
              <Input {...register('username')} />
              {errors.username && (
                <p className="text-xs text-red-400">{t(errors.username.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('common.email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
              )}
            </div>

            {/* Employee code (matrícula). Read-only when editing; on create
                we show a placeholder so the user knows the backend will mint
                one automatically (format: A + 7 dígitos, e.g. A0001234). */}
            <div className="space-y-2">
              <Label>{t('collaborators.employeeCode')}</Label>
              {isEdit ? (
                <Input {...register('customerUser.employeeCode')} disabled />
              ) : (
                <Input
                  disabled
                  placeholder={t('collaborators.employeeCodeAutoGenerated')}
                />
              )}
            </div>

            {!isEdit && (
              <div className="sm:col-span-2">
                <PasswordField
                  label={t('auth.password')}
                  value={watch('password') ?? ''}
                  onChange={(e) =>
                    setValue('password', e.target.value, { shouldValidate: false })
                  }
                  showPolicy
                  error={errors.password ? t(errors.password.message as string) : undefined}
                />
              </div>
            )}
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
