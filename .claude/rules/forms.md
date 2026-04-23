# Forms — useAppForm é obrigatório

## Regra

Todo formulário usa `useAppForm` de `@/hooks/use-app-form`. ESLint bloqueia `import { useForm } from 'react-hook-form'` fora desse arquivo.

## Anatomia padrão

```tsx
'use client';

import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, type UserInput } from './schemas';

export function UserFormDialog({ onSubmit }: Props) {
  const form = useAppForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Controllers + campos */}
    </form>
  );
}
```

## O que o wrapper garante

- `onInvalid` default: dispara toast com a primeira mensagem de erro (via `toastFirstError`). Se o caller passar seu próprio `onInvalid`, o default é sobrescrito.
- Log em dev quando schema rejeita (ajuda a debugar silent-submit).
- Tipagem automática a partir do schema Zod.

## Schemas

- Vivem em `src/features/<domínio>/schemas.ts`.
- Usar `z.infer<typeof schema>` para derivar o tipo.
- Para campos opcionais que o backend aceita como ausentes: `.optional()` + `src/lib/sanitize-payload.ts` no submit.
- Strings trimmed: `z.string().trim()`.

## FormData (upload de arquivo)

- Usar helpers em `src/lib/multipart-form-data.ts`.
- **Nunca** setar `Content-Type` manualmente (Axios cuida do boundary).
- Schema Zod aceita `File` via `z.instanceof(File)`.

## Pitfalls conhecidos

- **Silent submit**: passar `form.handleSubmit(onValid)` sem wrapper → Zod rejeita e nada acontece. Fix: `useAppForm`.
- **`defaultValues` mutáveis**: passar o mesmo objeto para várias instâncias causa vazamento entre dialogs. Sempre literal inline ou `useMemo`.
- **`Controller` esquecido em Radix**: Radix Select/Checkbox precisam de `Controller` — campos nativos podem usar `register`.

## Exemplo de referência

`src/features/users/user-form-dialog.tsx` e `src/features/alerts/schedule-form-dialog.tsx`.
