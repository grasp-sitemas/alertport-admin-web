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
  collaboratorFormSchema,
  type CollaboratorFormValues,
  DEFAULT_COLLABORATOR_VALUES,
} from './schemas';
import { usersService } from '@/services/users.service';
import type { User, UserFormData } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator?: User;
}

export function CollaboratorFormDialog({ open, onOpenChange, collaborator }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const isEdit = !!collaborator;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CollaboratorFormValues>({
    resolver: zodResolver(collaboratorFormSchema),
    defaultValues: collaborator
      ? {
          _id: collaborator._id,
          firstName: collaborator.firstName,
          lastName: collaborator.lastName,
          email: collaborator.email || '',
          username: collaborator.username,
          primaryPhone: collaborator.primaryPhone,
          status: collaborator.status,
        }
      : DEFAULT_COLLABORATOR_VALUES,
  });

  const mutation = useMutation({
    mutationFn: async (data: CollaboratorFormValues) => {
      const payload = {
        ...data,
        companyUser: {
          subtype: 'VIGILANT' as unknown as 'OPERATOR',
          status: data.status,
        },
      } as unknown as UserFormData;
      if (isEdit && collaborator) {
        return usersService.update(collaborator._id, payload);
      }
      return usersService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success(isEdit ? t('collaborators.updateSuccess') : t('collaborators.createSuccess'));
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
            {isEdit ? t('collaborators.editCollaborator') : t('collaborators.createCollaborator')}
          </DialogTitle>
          <DialogDescription>{t('collaborators.collaboratorDetails')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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
            </div>
            <div className="space-y-2">
              <Label>{t('common.phone')}</Label>
              <Input {...register('primaryPhone')} />
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
