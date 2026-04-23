# Gotchas — bugs observados + seus fixes

> Append-only. Acrescente novo item sempre que bater a cabeça em algo.

## Silent form submit
- **Sintoma**: clicar em "Salvar" não faz nada, sem toast, sem erro no console.
- **Causa**: form usa `useForm` cru de `react-hook-form` + `handleSubmit(onValid)`. Zod rejeita, `onInvalid` default é `undefined`.
- **Fix**: trocar para `useAppForm` (wrapper dispara toast com primeira mensagem).

## Loop de logout no load
- **Sintoma**: user loga, é redirecionado para `/login` imediatamente.
- **Causa**: algum probe no mount está jogando 401 — interceptor destrói sessão.
- **Fix**: probes precisam checar token existente antes de disparar; nunca 401 num GET opcional.

## FormData `Content-Type` quebrado
- **Sintoma**: backend responde 400 "multipart boundary missing".
- **Causa**: caller setou `headers['Content-Type'] = 'multipart/form-data'` manualmente.
- **Fix**: remover — Axios calcula o boundary sozinho.

## Chave i18n aparece literal na UI
- **Sintoma**: UI mostra `users.title` ao invés do texto.
- **Causa**: chave existe em pt.json mas falta em en/es/ja/zh (ou vice-versa).
- **Fix**: `/i18n-add` ou agente `i18n-sync`.

## `service:unavailable` banner teimoso
- **Sintoma**: banner de serviço indisponível fica preso na UI.
- **Causa**: 2+ falhas 5xx seguidas, estado não reseta sem request bem-sucedido.
- **Fix**: não retry-bomb. Reset acontece com sucesso de request.

## Paginação pulando registros
- **Sintoma**: paginador pula da página 1 para 3.
- **Causa**: alguém tratou `skip` como offset 0-indexed.
- **Fix**: `skip` é **page number 1-indexed**. Página 1 → `skip: 1`.

## Dialog abre com dados stale
- **Sintoma**: editar User A, fechar, abrir para User B — aparece dados de A.
- **Causa**: `defaultValues` é o mesmo objeto entre instâncias.
- **Fix**: `form.reset(initialData)` no `useEffect` que observa mudança do `initialData`.

## Firestore reprocessando eventos
- **Sintoma**: evento SOS disparado uma vez, aparece 5× na UI.
- **Causa**: documento não foi deletado após processar.
- **Fix**: chamar `deleteDoc` no handler (ver `.claude/skills/realtime-firestore/`).
