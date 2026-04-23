# Realtime — Firestore push + Socket.IO

## Firestore push (alertas)

Coleções assinadas em `src/features/alerts/realtime.ts`:

| Coleção | Uso |
|---|---|
| `notifications/{siteId}` | SOS / INCIDENT / CRASH / LOWVOLTAGE / TIME_ENTRY — filtra `source === 'ALERTPORT'` |
| `updatedMedias/{siteId}` | Foto/assinatura/áudio push |
| `updateAttendanceEvent/{siteGroupId}` | Update de atendimento ao vivo |
| `updateCloseAttendanceEvent/{siteGroupId}` | Atendimento encerrado |
| `updateAttendanceEventReport/{siteGroupId}` | Refresh do histórico |

### Regra crítica

**Documentos são deletados após processamento.** Padrão herdado do legado para evitar reprocessamento. Nunca re-ler o mesmo documento.

### Invalidação

`useAlertportRealtime` (`src/features/alerts/use-realtime.ts`) recebe o push e invalida as queries TanStack correspondentes. Sem polling.

## Socket.IO (chat / chamadas)

Contrato congelado em espelho de `shieldgo-admin-web/src/config/websocket.js`.

**Eventos emitidos:** `user:register`, `call:start`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`, `call:recording:upload`.

**Recebidos:** `connect`, `disconnect`, `user:list`, `call:incoming`, `call:accept`, `call:reject`, `call:end`, `call:duration:tick`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`.

### Implementação

`src/features/calls/use-call.ts`:
- Auto-registro no `connect` com `clientType: 'ADMIN_MONITOR'`.
- Reconexão infinita (Socket.IO built-in, 1s delay).
- Estados: `idle → connecting → outgoing/incoming → connected → ended`.
- Modos: **NORMAL** (áudio bidirecional) / **SILENT_LISTEN** (mic travado).
- Fila de offers/ICE para pacotes que chegam antes do PeerConnection estar pronto.
- Cleanup total no disconnect/unmount: streams, tracks, listeners — sem vazamentos.

## Regra

- **Não alterar nomes de eventos** (contrato compartilhado com dispositivos AlertPort em campo).
- Adicionar log com cautela — não vazar PII em produção.
- Testar cleanup manualmente (inspector → Memory) ao alterar `use-call.ts`.
