---
description: Escreve testes Vitest para schemas Zod de uma feature
argument-hint: <feature>
---

Gerar testes Vitest para todos os schemas em `src/features/$1/schemas.ts`.

Padrão:

```ts
import { describe, it, expect } from 'vitest';
import { userSchema } from './schemas';

describe('userSchema', () => {
  it('aceita payload válido', () => {
    const result = userSchema.safeParse({ /* ... */ });
    expect(result.success).toBe(true);
  });

  it('rejeita email inválido', () => {
    const result = userSchema.safeParse({ email: 'não-email' });
    expect(result.success).toBe(false);
  });

  it('permite campos opcionais ausentes', () => {
    // ...
  });
});
```

Cobrir:
- Happy path.
- Cada campo required ausente.
- Cada campo com formato inválido.
- Campos opcionais ausentes.
- Edge cases (string vazia, null, undefined).

Arquivo: `src/features/$1/schemas.test.ts`.

Ao final, rodar `npm test src/features/$1/schemas.test.ts`.
