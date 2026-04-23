---
name: useappform-pattern
description: Receita canônica para forms com useAppForm + Zod + Controller
---

# useAppForm — receita canônica

## Estrutura

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { userSchema, type UserInput } from './schemas';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: Partial<UserInput>;
  onSubmit: (data: UserInput) => Promise<void>;
}

export function UserFormDialog({ open, onOpenChange, initialData, onSubmit }: Props) {
  const t = useTranslations('users');
  const form = useAppForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', ...initialData },
  });

  const handleSubmit = async (data: UserInput) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Input
            {...form.register('name')}
            label={t('form.nameLabel')}
            error={form.formState.errors.name?.message}
          />
          <Controller
            name="role"
            control={form.control}
            render={({ field, fieldState }) => (
              <RoleSelect {...field} error={fieldState.error?.message} />
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## Pontos críticos

1. `'use client'` no topo (forms vivem no client).
2. `zodResolver(schema)` — nunca `yupResolver` ou outros.
3. `useAppForm` — nunca `useForm` cru.
4. `Controller` para Radix/componentes custom; `register` direto só para inputs nativos.
5. `form.reset()` após submit — evita defaults stale.
6. Error rendering: `formState.errors.<field>?.message` ou via Controller's `fieldState`.

## Referências

`src/features/users/user-form-dialog.tsx`, `src/features/alerts/schedule-form-dialog.tsx`.
