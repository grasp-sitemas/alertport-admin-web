/**
 * Operator sees the caller's site name + last-four of the device id on the
 * ringing modal — never the raw device id. This test locks in the
 * `{siteName} - {last4}` contract from use-call.ts/onIncoming.
 */

import { describe, expect, it } from 'vitest';
import { formatIncomingPeerLabel } from '@/features/calls/use-call';
import type { IncomingCallPayload } from '@/lib/socket';

function make(partial: Partial<IncomingCallPayload>): IncomingCallPayload {
  return {
    roomId: 'call_x',
    from: 'abcdef0102b2',
    callMode: 'NORMAL',
    ...partial,
  };
}

describe('formatIncomingPeerLabel', () => {
  it('composes "Site - last4" from fromLabel when set', () => {
    expect(
      formatIncomingPeerLabel(make({ fromLabel: 'Hospital Brasil' })),
    ).toBe('Hospital Brasil - 02b2');
  });

  it('prefers fromLabel over fromDisplayName when both are present', () => {
    expect(
      formatIncomingPeerLabel(
        make({ fromLabel: 'Posto Norte', fromDisplayName: 'ignored' }),
      ),
    ).toBe('Posto Norte - 02b2');
  });

  it('falls back to fromDisplayName when fromLabel is empty', () => {
    expect(
      formatIncomingPeerLabel(make({ fromDisplayName: 'Posto Sul' })),
    ).toBe('Posto Sul - 02b2');
  });

  it('uses the "Dispositivo" placeholder when the server echoes the userId as label', () => {
    expect(
      formatIncomingPeerLabel(
        make({ from: 'abcdef0102b2', fromLabel: 'abcdef0102b2' }),
      ),
    ).toBe('Dispositivo - 02b2');
  });

  it('uses the "Dispositivo" placeholder when no label is provided', () => {
    expect(formatIncomingPeerLabel(make({}))).toBe('Dispositivo - 02b2');
  });

  it('handles short device ids (less than 4 chars) gracefully', () => {
    expect(
      formatIncomingPeerLabel(make({ from: 'x', fromLabel: 'Site' })),
    ).toBe('Site - x');
  });

  it('lowercases the last four hex chars so the id reads consistently', () => {
    expect(
      formatIncomingPeerLabel(
        make({ from: 'ABCDEF0102B2', fromLabel: 'Hospital' }),
      ),
    ).toBe('Hospital - 02b2');
  });
});
