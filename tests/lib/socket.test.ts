/**
 * Tests for the ms-chat socket singleton.
 *
 * The socket is shared across every page (monitor, recordings,
 * call dialog) - a second connection would duplicate every incoming
 * call:incoming event and double-ring the modal. These tests lock
 * the singleton behavior:
 *   - getSocket returns the same instance across calls
 *   - disconnectSocket fully tears down so the next getSocket
 *     starts fresh (matters for logout + re-login during the same
 *     tab session)
 *   - io() is called with the legacy-compatible configuration so we
 *     cant silently drift from the shieldgo contract
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function withIoStub(
  ioFactory: () => { ioMock: ReturnType<typeof vi.fn>; fakeSocket: Record<string, unknown> },
) {
  const { ioMock, fakeSocket } = ioFactory();
  vi.doMock('socket.io-client', () => ({
    io: ioMock,
    Socket: class {},
  }));
  const mod = await import('@/lib/socket');
  return { mod, ioMock, fakeSocket };
}

function buildFakeSocket() {
  const removeAllListeners = vi.fn();
  const disconnect = vi.fn();
  return {
    removeAllListeners,
    disconnect,
    connected: false,
  };
}

describe('getSocket', () => {
  it('returns the same singleton across calls (no duplicate connections)', async () => {
    const fakeSocket = buildFakeSocket();
    const ioMock = vi.fn(() => fakeSocket);
    const { mod } = await withIoStub(() => ({ ioMock, fakeSocket }));
    const s1 = mod.getSocket();
    const s2 = mod.getSocket();
    expect(s1).toBe(s2);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('calls io() with the legacy-compatible reconnection config', async () => {
    const fakeSocket = buildFakeSocket();
    const ioMock = vi.fn(() => fakeSocket);
    const { mod } = await withIoStub(() => ({ ioMock, fakeSocket }));
    mod.getSocket();
    const call = ioMock.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const opts = call[1];
    expect(opts.reconnection).toBe(true);
    expect(opts.reconnectionDelay).toBe(1000);
    expect(opts.reconnectionAttempts).toBe(Infinity);
    expect(opts.autoConnect).toBe(true);
    // websocket-preferred transport list is key for Heroku reliability.
    expect(opts.transports).toEqual(['websocket', 'polling']);
  });
});

describe('disconnectSocket', () => {
  it('removes listeners, calls disconnect, and resets the singleton', async () => {
    const fakeSocket = buildFakeSocket();
    const ioMock = vi.fn(() => fakeSocket);
    const { mod } = await withIoStub(() => ({ ioMock, fakeSocket }));
    mod.getSocket();
    mod.disconnectSocket();
    expect(fakeSocket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
    // After disconnect, the next getSocket must create a fresh instance.
    mod.getSocket();
    expect(ioMock).toHaveBeenCalledTimes(2);
  });

  it('is a safe no-op when there is no active socket', async () => {
    const fakeSocket = buildFakeSocket();
    const ioMock = vi.fn(() => fakeSocket);
    const { mod } = await withIoStub(() => ({ ioMock, fakeSocket }));
    expect(() => mod.disconnectSocket()).not.toThrow();
  });
});
