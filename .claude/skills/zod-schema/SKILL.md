---
name: zod-schema
description: Padrão para escrever Zod schemas compatíveis com os contratos backend do AlertPort
---

# Zod schemas — padrão AlertPort

## Estrutura

```ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório'),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']),
  archived: z.boolean().default(false),
});

export type UserInput = z.infer<typeof userSchema>;
```

## Regras

- **Trim strings**: `z.string().trim()` — backend não aceita padding.
- **Campos opcionais do backend**: `.optional()` + passar por `src/lib/sanitize-payload.ts` antes de POST.
- **Enums**: `z.enum([...])` espelhando valores literais do backend.
- **Nullable vs optional**: backend distingue. `null` explícito → `.nullable()`; campo ausente → `.optional()`.
- **Infer types**: sempre `z.infer<typeof schema>` — não duplicar manualmente.

## Sub-schemas reutilizáveis

Ver `src/features/shared/` para:
- Endereço (viaCEP integration).
- Telefone (máscara + E.164).
- Geolocalização.

Importe e componha:
```ts
import { addressSchema } from '@/features/shared/address-schema';

export const siteSchema = z.object({
  name: z.string().trim().min(1),
  address: addressSchema,
});
```

## Validação async

Para ViaCEP / checks de unicidade:
```ts
name: z.string().trim().refine(async (v) => !(await isDuplicate(v)), {
  message: 'Nome já existe',
}),
```

## Testes

Sempre acompanhar de `schemas.test.ts` cobrindo happy path + cada campo required ausente + inválido.
