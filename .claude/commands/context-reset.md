---
description: Comprime aprendizados da sessão em agent-memory e prepara contexto limpo
---

Antes de encerrar esta sessão ou compactar o contexto:

1. Extraia 3–8 bullets de "lessons learned" desta sessão:
   - Gotchas descobertos.
   - Decisões tomadas que valem persistir.
   - Mapeamentos entre shieldgo ↔ alertport encontrados.
   - Erros que já apareceram 2+ vezes.

2. Acrescente (append) ao arquivo `.claude/agent-memory/learned.md` no formato:
   ```
   ## <YYYY-MM-DD> — <título curto>
   - bullet 1
   - bullet 2
   ```

3. Se for um bug/gotcha novo: acrescente também a `.claude/agent-memory/gotchas.md`.

4. Se for um invariante recém-descoberto: acrescente a `.claude/agent-memory/invariants.md`.

5. Reporte o diff e peça confirmação antes de salvar se algum bullet parecer sensível (PII, nomes de cliente, secrets).

Formato: markdown plano, terse. Sem boilerplate.
