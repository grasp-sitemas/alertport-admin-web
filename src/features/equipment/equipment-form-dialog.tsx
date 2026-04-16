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
import {
  equipmentFormSchema,
  type EquipmentFormValues,
  DEFAULT_EQUIPMENT_VALUES,
} from './schemas';
import { equipmentService } from '@/services/equipment.service';
import type { Equipment } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment;
}

export function EquipmentFormDialog({ open, onOpenChange, equipment }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!equipment;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: equipment
      ? {
          _id: equipment._id,
          name: equipment.name,
          brand: equipment.brand,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          type: equipment.type,
          status: equipment.status,
        }
      : DEFAULT_EQUIPMENT_VALUES,
  });

  const mutation = useMutation({
    mutationFn: async (data: EquipmentFormValues) => {
      if (isEdit && equipment) return equipmentService.update(equipment._id, data);
      return equipmentService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success(isEdit ? t('equipment.updateSuccess') : t('equipment.createSuccess'));
      onOpenChange(false);
      reset();
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('equipment.editEquipment') : t('equipment.createEquipment')}
          </DialogTitle>
          <DialogDescription>{t('equipment.equipmentDetails')}</DialogDescription>
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
              <Label>{t('equipment.brand')}</Label>
              <Input {...register('brand')} />
            </div>
            <div className="space-y-2">
              <Label>{t('equipment.model')}</Label>
              <Input {...register('model')} />
            </div>
            <div className="space-y-2">
              <Label>{t('equipment.serialNumber')}</Label>
              <Input {...register('serialNumber')} />
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
