---
description: Compara implementação AlertPort com o legado shieldgo-admin-web
argument-hint: <arquivo-ou-símbolo>
---

Comparar `$1` entre `shieldgo-admin-web` (legado) e `alertport-admin-web` (atual).

Passos:

1. Procurar `$1` em `../shieldgo-admin-web/` (assume sibling worktree). Se não existir, pedir ao usuário para clonar/montar.
2. Procurar o equivalente em `src/` usando o mapeamento de `.claude/agent-memory/legacy-map.md` (ou `MIGRATION.md`).
3. Diff semântico:
   - Endpoints (URL, método, payload shape).
   - Roles permitidos.
   - Validações.
   - Estados do fluxo.
4. Reportar:
   - O que foi preservado.
   - O que mudou (com motivo se conhecido).
   - Possíveis regressões.

Saída em formato tabular ou bullet list, conciso.
