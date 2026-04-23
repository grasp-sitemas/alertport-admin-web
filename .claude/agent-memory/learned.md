# Learned — log incremental de lições de sessão

> Cada sessão pode acrescentar um bloco. Formato: `## YYYY-MM-DD — título curto` + bullets.
> Agente pode consolidar via `/context-reset`.

## 2026-04-23 — bootstrap da estrutura Claude Code

- Reescrito `CLAUDE.md` no template v4 (Context · How I Work · Playbooks · Do Not · Known Failure Modes · How to Ask) com invariantes do AlertPort.
- Criado `.claude/` completo: settings, rules (14), commands (11), agents (7), skills (7), hooks (4), agent-memory (5).
- `.mcp.json` cobre github + playwright + filesystem (bounded).
- Permissões em `settings.json` bloqueiam `rm -rf`, force-push, amend, `--no-verify`, `--no-gpg-sign`. Leituras de `.env.local|.env.production|.env.hml` bloqueadas por padrão.
- Hooks: SessionStart banner de orientação; PostToolUse formata via Prettier; Stop lembra de `/pr-ready` se houver mudanças; PreCompact lembra de `/context-reset`.
- Convenções reforçadas via rules: `useAppForm` (forms), token literal sem `Bearer` (api-contracts), `skip` 1-indexed (api-contracts), `force-dynamic` em rotas autenticadas (nextjs-16), paridade 5 locales (i18n).
