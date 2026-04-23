---
name: force-dynamic-route
description: Boilerplate de rota protegida com force-dynamic + RoleGuard
---

# Rota protegida — boilerplate

## Arquivo: `src/app/(app)/<path>/page.tsx`

```tsx
'use client';

export const dynamic = 'force-dynamic';

import { RoleGuard } from '@/components/shared/role-guard';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslations } from 'next-intl';

export default function <Name>Page() {
  const t = useTranslations('<namespace>');

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <PageHeader title={t('title')} description={t('description')} />
      {/* conteúdo */}
    </RoleGuard>
  );
}
```

## Por quê `force-dynamic`

A rota lê `sessionStorage['alertport_session']` em runtime. Pré-render gera HTML sem sessão → flash de "não autenticado" + redirect loop.

## Metadata (opcional)

```ts
export const metadata = { title: 'Título — AlertPort' };
```

Para metadata dinâmica, usar `generateMetadata` — lembre que `params` e `searchParams` são Promise no Next 16.

## Não

- ❌ `export const dynamic = 'auto'` ou omitir → Next tentará prerender.
- ❌ `<RoleGuard>` faltando.
- ❌ Rota nova sem entrada em `src/config/navigation.ts`.
