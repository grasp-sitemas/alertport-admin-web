'use client';

/**
 * Global call context.
 *
 * Lifts `useCall()` above the router so the ms-chat socket stays connected and
 * any `call:incoming` arriving from a device is received **on any page**.
 * Mirrors the shieldgo-admin-web pattern where App.vue holds the socket
 * listeners and shows a ringing modal regardless of the current route.
 */

import { createContext, useContext } from 'react';
import { useCall, type CallActions, type CallState } from './use-call';
import { CallDialog } from './call-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useSessionAccountModules } from '@/features/modules/use-session-account-modules';

type CallContextValue = (CallState & CallActions) | null;

const CallContext = createContext<CallContextValue>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { isEnabled, isLoading } = useSessionAccountModules();
  const callsEnabled =
    isAuthenticated &&
    !isLoading &&
    (isEnabled('CALL_NORMAL') || isEnabled('CALL_SILENT'));
  const call = useCall(callsEnabled);

  return (
    <CallContext.Provider value={callsEnabled ? call : null}>
      {children}
      {/* Global call dialog - shows on any page whenever a call is active */}
      {callsEnabled ? <CallDialog {...call} /> : null}
    </CallContext.Provider>
  );
}

/**
 * Consume the global call state from any page / component.
 * Returns `null` when the user is not authenticated - callers should handle
 * that case (e.g. render nothing or disable call actions).
 */
export function useCallContext(): CallContextValue {
  return useContext(CallContext);
}
