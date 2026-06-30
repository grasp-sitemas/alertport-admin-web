# API Contracts — Invariantes do Backend

> Quirks imutáveis herdadas do legado. Nunca "normalizar" sem ordem explícita.

## Auth

- Header: `Authorization: <token>` — **literal, sem `Bearer`**. Ver `src/lib/api-client.ts` interceptor de request.
- `x-correlation-id` propagado quando presente no payload da sessão.
- Sessão vive em `sessionStorage['alertport_session']` — nunca cookie, nunca localStorage.

## Paginação

- `skip` é **page number 1-indexed**, não offset. Página 1 = primeiros N itens. Ver `src/hooks/use-pagination.ts`.
- `limit` padrão herdado do legado (`25`/`50`). Não alterar sem motivo.
- Infinite scroll: incrementa `skip`, não calcula offset.

## Filtros

- Endpoints de filtro são **POST** com JSON body, não GET com query params. Exemplos: `/api/company/filter/v1/`, `/api/users/bytype/v1/*`, `/api/schedules/occurences/filter/v1/`.
- Auto-scope: `account/client/site` são injetados do usuário logado via `src/hooks/use-filters.ts`. Não bypassar — quebra endpoints para roles mais estreitos.

## Retry e falhas

- Retry automático em `5xx / 408 / 429` → até **2 tentativas**, delay linear de `1s`.
- `401` → interceptor destrói sessão e redireciona para `/login`. Nunca jogar 401 a partir de probe não autenticado (loop de logout).
- 2 falhas consecutivas de `5xx`/rede disparam evento `service:unavailable`. Não retry-bomb.

## FormData / uploads

- **Não setar `Content-Type` manualmente** em requests FormData. Axios precisa calcular o boundary. Ver helpers em `src/lib/multipart-form-data.ts` e `src/lib/api-client.ts`.
- Sanitização de payload: `src/lib/sanitize-payload.ts` remove `null`/`undefined`/`""` antes de POST onde o legado esperava campo ausente.

## Endpoints catalogados

Única fonte de verdade: `src/config/endpoints.ts`. Nunca hardcodar URL em service.

## Tipos

- Shape de request/response vive em `src/types/api.ts`.
- Se mudar campo, documentar em `MIGRATION.md` e rodar contract test em `tests/contracts/`.

## PatrolAction — novos tipos de evento de dispositivo

`PatrolAction.type` agora inclui três valores para eventos de energia/bateria (épico B):

| Tipo | Significado |
|---|---|
| `DEVICE_AC_LOST` | Dispositivo desconectado da alimentação AC |
| `DEVICE_AC_RESTORED` | Dispositivo reconectado à alimentação AC |
| `DEVICE_BATTERY_LOW` | Bateria do dispositivo abaixo do limiar crítico |

Estes aparecem no monitor de alertas e são enviados via Firestore `notifications/{siteId}` com `source === 'ALERTPORT'`. O model também expõe um campo `deviceStatus`. Ver `.claude/rules/realtime.md`.

## Checklist antes de alterar qualquer um desses itens

1. Confirmou com backend que a mudança saiu?
2. Abriu issue citando o contrato específico?
3. Atualizou types + endpoints + fixtures?
4. Em dúvida → pergunta ao usuário antes de editar.
