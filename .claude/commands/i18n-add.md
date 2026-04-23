---
description: Adiciona chave i18n nos 5 locales (pt real, demais placeholder)
argument-hint: <namespace.key> "<texto em pt>"
---

Adicionar chave `$1` com valor `$2` em **todos os 5 arquivos** de `src/messages/`.

Passos:

1. Adicionar em `src/messages/pt.json` com o texto passado.
2. Adicionar em `src/messages/{en,es,ja,zh}.json` com placeholder `[TODO:<locale>] $2` para sinalizar tradução pendente.
3. Manter o path completo da chave (e.g. `users.form.nameLabel`) — criar namespaces aninhados se necessário.
4. Reportar cada arquivo tocado.

Depois:
- Se puder traduzir manualmente, atualizar os outros locales.
- Senão, abrir tarefa para revisão de tradutor.

Verificação:
- Rode `npm run typecheck` (pegar key references quebradas).
- Conferir nenhum `[TODO:*]` commitado vai para produção — é placeholder explícito.
