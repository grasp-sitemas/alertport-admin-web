---
name: route-scaffold
description: Scaffolds uma rota protegida nova seguindo o playbook. Use quando o usuário pedir "nova rota" ou "nova página em /app/".
tools: Read, Write, Edit, Bash
model: sonnet
---

Você scaffolds rota protegida nova em `src/app/(app)/<path>/`.

## Passos

1. Perguntar (se não informado):
   - Path (e.g. `sites/manage`).
   - Roles permitidos (default: todos menos AUDITOR).
   - Se terá CRUD (→ gera Playwright smoke).

2. Criar `src/app/(app)/<path>/page.tsx`:
   ```tsx
   'use client';

   export const dynamic = 'force-dynamic';

   import { RoleGuard } from '@/components/shared/role-guard';
   import { useTranslations } from 'next-intl';

   export default function <Name>Page() {
     const t = useTranslations('<namespace>');
     return (
       <RoleGuard roles={[/* ... */]}>
         <h1>{t('title')}</h1>
       </RoleGuard>
     );
   }
   ```

3. Adicionar entrada em `src/config/navigation.ts`.

4. Adicionar chaves de tradução em todos os 5 arquivos de `src/messages/` (namespace da feature + entrada em `sidebar`).

5. Atualizar matriz em `.claude/rules/roles-matrix.md`.

6. Se CRUD: criar `tests/e2e/<path>.spec.ts` com smoke de navegação + visibilidade básica.

## Validação

Ao final, rodar `npm run typecheck` e reportar.
