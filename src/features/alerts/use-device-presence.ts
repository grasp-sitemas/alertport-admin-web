'use client';

import { useMemo } from 'react';

export interface DevicePresence {
  /** Set of online device socket userIds (account-scoped). */
  onlineDeviceIds: Set<string>;
  /** True when `id` is known and NOT in the online set. */
  isOffline: (id: string | null | undefined) => boolean;
}

/**
 * Reactive device presence derived from the ms-chat `user:list` feed.
 *
 * Why it reads from an existing list instead of attaching its own socket
 * listeners: the single chat socket is owned by `useCall` (lifted into the
 * global CallProvider). That hook already subscribes to `user:list` and the
 * ms-chat server **re-broadcasts the full account-scoped list on every
 * connect/disconnect** (`broadcastUserList` runs after register and after a
 * socket drops), so `user:online` / `user:offline` deltas are already folded
 * into the list we receive. Attaching a second `user:list` listener here would
 * be clobbered anyway — `useCall` registers it with `socket.off('user:list')`.
 * Reusing the maintained list keeps a single socket connection (no second
 * connection) and a single source of truth.
 *
 * Pass `call?.onlineUsers` from `useCallContext()`. When the chat socket is
 * not available (calls disabled for the tenant, or unauthenticated) the list
 * is empty and `isOffline` returns false for everything — the caller should
 * gate the UI on presence being available rather than show every device as
 * offline.
 *
 * @param onlineUserIds Live list of online socket userIds (account-scoped).
 */
export function useDevicePresence(onlineUserIds: readonly string[] | undefined): DevicePresence {
  return useMemo<DevicePresence>(() => {
    const onlineDeviceIds = new Set(onlineUserIds ?? []);
    return {
      onlineDeviceIds,
      isOffline: (id) => {
        if (!id) return false;
        // Presença indisponível (undefined) ≠ ninguém online ([]). Quando
        // indisponível não podemos afirmar que alguém está offline.
        if (onlineUserIds === undefined) return false;
        return !onlineDeviceIds.has(id);
      },
    };
  }, [onlineUserIds]);
}
