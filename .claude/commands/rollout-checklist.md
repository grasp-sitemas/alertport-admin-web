---
description: Checklist pre-merge completo
---

Produza checklist marcado para o estado atual da branch:

## Contratos
- [ ] Nenhum endpoint alterou shape
- [ ] Nenhum `Bearer` adicionado
- [ ] `skip` permanece 1-indexed
- [ ] Filtros continuam POST

## i18n
- [ ] Todas as chaves novas em 5 locales
- [ ] Nenhum `[TODO:*]` sobrou

## Rotas
- [ ] Rotas novas em `(app)/` declaram `force-dynamic`
- [ ] Rotas novas envolvidas em `<RoleGuard>`
- [ ] `navigation.ts` atualizada
- [ ] Matriz em `.claude/rules/roles-matrix.md` atualizada

## Forms
- [ ] Nenhum `useForm` cru fora do wrapper
- [ ] Schemas Zod com `z.infer`

## Testes
- [ ] `npm run validate` passa
- [ ] Vitest cobre schemas novos
- [ ] Playwright smoke para CRUD novo

## Infra
- [ ] Sem `localStorage['token']` / cookies
- [ ] Sem secrets em `.env*` commitados
- [ ] Sem hardcode de cores (tokens de `globals.css`)

Para cada item não marcado, proponha ação específica.
