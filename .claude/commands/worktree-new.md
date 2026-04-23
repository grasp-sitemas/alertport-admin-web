---
description: Cria worktree isolada para trabalho paralelo (Claude agents em paralelo)
argument-hint: <nome-da-tarefa>
allowed-tools: Bash(git worktree:*), Bash(cp:*), Bash(mkdir:*), Bash(ls:*)
---

Criar worktree `../alertport-admin-web-$1` para trabalhar em paralelo à branch principal.

Passos:

1. `git worktree add ../alertport-admin-web-$1 -b claude/$1`.
2. Copiar para a worktree os arquivos listados em `.worktreeinclude`:
   - `.env.local` (se existir)
   - `.env.hml`
   - `.claude/settings.local.json` (se existir)
   - `.claude/agent-memory/` (inteiro)
3. Sugerir: `cd ../alertport-admin-web-$1 && npm install` se `node_modules` não veio.
4. Reportar path absoluto da nova worktree.

Uso típico:
- Scaffolding grande numa worktree enquanto a main roda CI/validate.
- Isolar experimentos arriscados (upgrade de lib, refactor amplo).

Limpeza:
- `git worktree remove ../alertport-admin-web-$1` quando terminar.
