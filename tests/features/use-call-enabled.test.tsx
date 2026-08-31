import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const socket: {
    connected: boolean;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  } = {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  socket.on.mockImplementation(() => socket);
  socket.off.mockImplementation(() => socket);
  socket.emit.mockImplementation((event: string, _payload: unknown, ack?: (value: unknown) => void) => {
    if (event === 'user:register') ack?.({ ok: true });
    return socket;
  });

  return {
    socket,
    getSocket: vi.fn(() => socket),
    user: {
      _id: 'user-1',
      firstName: 'E2E',
      lastName: 'Operator',
      account: { _id: 'account-1' },
      companyUser: { subtype: 'ADMIN' },
    },
  };
});

vi.mock('@/lib/socket', () => ({
  getSocket: mocks.getSocket,
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

import { useCall } from '@/features/calls/use-call';

afterEach(() => {
  mocks.socket.connected = false;
  mocks.socket.on.mockClear();
  mocks.socket.off.mockClear();
  mocks.socket.emit.mockClear();
  mocks.getSocket.mockClear();
});

describe('useCall socket gate', () => {
  it('does not create the socket while disabled and clears state when disabled again', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useCall(enabled),
      { initialProps: { enabled: false } },
    );

    expect(mocks.getSocket).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(mocks.getSocket).toHaveBeenCalledTimes(1);

    const connect = mocks.socket.on.mock.calls.find(([event]) => event === 'connect')?.[1];
    const userList = mocks.socket.on.mock.calls.find(([event]) => event === 'user:list')?.[1];
    const incoming = mocks.socket.on.mock.calls.find(
      ([event]) => event === 'call:incoming',
    )?.[1];
    expect(connect).toBeTypeOf('function');
    expect(userList).toBeTypeOf('function');
    expect(incoming).toBeTypeOf('function');

    act(() => {
      connect();
      userList({ users: ['device-1'] });
      incoming({ roomId: 'room-1', from: 'device-1', callMode: 'NORMAL' });
    });
    expect(result.current.socketConnected).toBe(true);
    expect(result.current.socketReady).toBe(true);
    expect(result.current.onlineUsers).toEqual(['device-1']);
    expect(result.current.status).toBe('incoming');
    expect(result.current.roomId).toBe('room-1');

    rerender({ enabled: false });

    expect(mocks.getSocket).toHaveBeenCalledTimes(1);
    expect(result.current.socketConnected).toBe(false);
    expect(result.current.socketReady).toBe(false);
    expect(result.current.onlineUsers).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.roomId).toBeNull();
    expect(mocks.socket.off).toHaveBeenCalledWith('connect', connect);
  });
});
