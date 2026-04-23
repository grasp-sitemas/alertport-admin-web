---
description: Portão pre-PR — validate + paridade locale + imports banidos + force-dynamic
allowed-tools: Bash(npm run validate), Bash(git diff:*), Bash(git status), Bash(grep:*), Bash(rg:*)
---

Rode o portão pre-PR:

## 1. `npm run validate`
Typecheck + lint + test + build.

## 2. Paridade de locales
Liste chaves em `src/messages/pt.json` e confira se existem em en/es/ja/zh. Reporte quais faltam.

## 3. Imports banidos
Procure no diff:
- `import { useForm } from 'react-hook-form'` fora de `src/hooks/use-app-form.ts` → **BANIDO**.
- `Authorization: Bearer` em qualquer lugar → **BANIDO**.
- `skip` sendo usado como offset 0-indexed → **BANIDO**.
- Hardcode de cor (`#RRGGBB`, `bg-[#...]`) em JSX/CSS → **AVISO**.

## 4. `force-dynamic` em rotas novas
Para cada `page.tsx` novo em `src/app/(app)/`, verificar `export const dynamic = 'force-dynamic'`.

## 5. Sessão
Procure uso de `localStorage` ou `document.cookie` com `token` → **BANIDO**.

## Output

Tabela com ✅ / ❌ por check + lista de issues. Se tudo passar: "PR pronto para abrir".
