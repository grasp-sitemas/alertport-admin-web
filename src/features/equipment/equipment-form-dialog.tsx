'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  equipmentFormSchema,
  type EquipmentFormValues,
  DEFAULT_EQUIPMENT_VALUES,
} from './schemas';
import { equipmentService } from '@/services/equipment.service';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import type { Equipment } from '@/types/api';
import { translateDynamicLabel } from '@/lib/i18n-labels';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment;
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

export function EquipmentFormDialog({ open, onOpenChange, equipment }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!equipment;
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const brandsQuery = useQuery({
    queryKey: ['lookup', 'equipment-brands'],
    queryFn: () => equipmentService.getBrands(),
    staleTime: 5 * 60 * 1000,
  });
  const typesQuery = useQuery({
    queryKey: ['lookup', 'equipment-types'],
    queryFn: () => equipmentService.getTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const defaults: EquipmentFormValues = equipment
    ? {
        _id: equipment._id,
        legacyId: equipment.legacyId ?? '',
        account: getIdOrEmpty(equipment.account),
        client: getIdOrEmpty(equipment.client),
        site: getIdOrEmpty(equipment.site),
        code: equipment.code ?? equipment.name ?? '',
        type: equipment.type ?? '',
        brand: equipment.brand ?? '',
        user: typeof equipment.user === 'string' ? equipment.user : '',
        hasImport: equipment.hasImport ?? true,
        companyLegacyParentId: equipment.companyLegacyParentId ?? '',
        status: equipment.status ?? 'ACTIVE',
      }
    : {
        ...DEFAULT_EQUIPMENT_VALUES,
        account: canSelectAccount ? '' : sessionAccountId || '',
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, equipment?._id]);

  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined);

  const saveMutation = useMutation({
    mutationFn: async (data: EquipmentFormValues) => {
      const payload = { ...data };
      if (isEdit && equipment) return equipmentService.update(equipment._id, payload);
      return equipmentService.create(payload);
    },
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'equipment');
      toast.success(isEdit ? t('equipment.updateSuccess') : t('equipment.createSuccess'));
      onOpenChange(false);
      reset(DEFAULT_EQUIPMENT_VALUES);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  // Refs to clear children cascades
  let prevAccount = defaults.account;
  let prevClient = defaults.client;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('equipment.editEquipment') : t('equipment.createEquipment')}
          </DialogTitle>
          <DialogDescription>{t('equipment.equipmentDetails')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canSelectAccount && (
              <div className="space-y-2 sm:col-span-3">
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
              <Label>{t('equipment.code')}</Label>
              <Input {...register('code')} />
              {errors.code && (
                <p className="text-xs text-red-400">{t(errors.code.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('equipment.typeField')}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                      <SelectContent>
                        {(typesQuery.data ?? []).map((tp) => (
                          <SelectItem key={tp._id} value={tp._id}>
                            {translateDynamicLabel(tp.name, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('equipment.brand')}</Label>
              <Controller
                control={control}
                name="brand"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                      <SelectContent>
                        {(brandsQuery.data ?? []).map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {translateDynamicLabel(b.name, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
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
