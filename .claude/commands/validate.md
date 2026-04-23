---
description: Roda o portão de validação completo (typecheck + lint + test + build)
allowed-tools: Bash(npm run validate), Bash(npm run typecheck), Bash(npm run lint), Bash(npm test), Bash(npm run build)
---

Rode `npm run validate` e reporte:

1. **Status geral**: PASS / FAIL.
2. Se FAIL: primeiro erro de cada etapa (typecheck / lint / test / build) com arquivo e linha.
3. Se PASS: apenas confirme e sugira próximos passos (`/pr-ready` ou abrir PR).

Não tente fix automático — só reporte.
