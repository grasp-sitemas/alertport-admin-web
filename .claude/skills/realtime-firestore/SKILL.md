---
name: realtime-firestore
description: Padrão Firestore subscribe → invalidate → delete
---

# Realtime Firestore — padrão AlertPort

## Estrutura

Em `src/features/alerts/realtime.ts`:

```ts
import { onSnapshot, collection, doc, deleteDoc, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export function subscribeNotifications(siteId: string, onEvent: (data: Notification) => void) {
  const q = query(
    collection(firestore, `notifications/${siteId}`),
    where('source', '==', 'ALERTPORT'),
  );

  return onSnapshot(q, async (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type === 'added') {
        onEvent(change.doc.data() as Notification);
        // Regra crítica: deletar após processar
        await deleteDoc(doc(firestore, `notifications/${siteId}/${change.doc.id}`));
      }
    }
  });
}
```

## Integração com TanStack Query

`src/features/alerts/use-realtime.ts`:

```ts
export function useAlertportRealtime(siteId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!siteId) return;
    const unsub = subscribeNotifications(siteId, (evt) => {
      invalidateAlerts(qc);
      if (evt.type === 'TIME_ENTRY') invalidateAttendance(qc);
    });
    return unsub;
  }, [siteId, qc]);
}
```

## Regras

- **Delete após processar** — documento ficar → reprocessamento em loop.
- **Não re-ler** o mesmo documento.
- **Source filter** obrigatório (`source === 'ALERTPORT'`) — evita ruído de outras apps no mesmo Firestore.
- **Cleanup** em unmount — sempre retornar `unsub` do `useEffect`.

## Coleções suportadas

Ver `.claude/rules/realtime.md` para a tabela completa.
