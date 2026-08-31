import { useEffect } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticated: true,
  modulesLoading: true,
  callsEnabled: false,
  useCall: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: mocks.authenticated }),
}));

vi.mock('@/features/modules/use-session-account-modules', () => ({
  useSessionAccountModules: () => ({
    isLoading: mocks.modulesLoading,
    isEnabled: (module: string) =>
      mocks.callsEnabled && (module === 'CALL_NORMAL' || module === 'CALL_SILENT'),
  }),
}));

vi.mock('@/features/calls/use-call', () => ({
  useCall: (enabled?: boolean) => {
    mocks.useCall(enabled);
    return {};
  },
}));

vi.mock('@/features/calls/call-dialog', () => ({
  CallDialog: () => null,
}));

import { CallProvider } from '@/features/calls/call-context';

afterEach(() => {
  cleanup();
  mocks.authenticated = true;
  mocks.modulesLoading = true;
  mocks.callsEnabled = false;
  mocks.useCall.mockReset();
});

describe('CallProvider', () => {
  it('keeps children mounted while the module decision enables the socket', () => {
    let mounts = 0;
    let unmounts = 0;

    function Probe() {
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return <div>child</div>;
    }

    const { rerender } = render(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );

    expect(mocks.useCall).toHaveBeenLastCalledWith(false);
    expect(mounts).toBe(1);

    mocks.modulesLoading = false;
    mocks.callsEnabled = true;
    rerender(
      <CallProvider>
        <Probe />
      </CallProvider>,
    );

    expect(mocks.useCall).toHaveBeenLastCalledWith(true);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
  });
});
