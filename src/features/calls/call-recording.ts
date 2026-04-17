/**
 * Browser-side call recording, ported from shieldgo-admin-web
 * (src/services/callRecordingBridge.js) to TypeScript.
 *
 * Captures the mic (local) + the remote stream via an AudioContext
 * destination, feeds a MediaRecorder, and uploads the final audio blob to
 * ms-chat via the existing `call:recording:upload` socket event — same shape
 * the server already accepts, no backend change required.
 *
 * Used primarily by SILENT_LISTEN, where the operator must persist the audio
 * even when the device is unaware the line is open. The server-side
 * `callRecordingEnabled` account flag (delivered on `call:start` ack) still
 * governs whether anything is captured.
 */

import type { Socket } from 'socket.io-client';

export interface CallRecordingState {
  enabledByPolicy: boolean;
  startedAt: string | null;
  mediaRecorder: MediaRecorder | null;
  mimeType: string;
  chunks: Blob[];
  audioContext: AudioContext | null;
  destination: MediaStreamAudioDestinationNode | null;
  streamSources: Record<string, MediaStreamAudioSourceNode>;
  isUploading: boolean;
}

export function createCallRecordingState(): CallRecordingState {
  return {
    enabledByPolicy: false,
    startedAt: null,
    mediaRecorder: null,
    mimeType: '',
    chunks: [],
    audioContext: null,
    destination: null,
    streamSources: {},
    isUploading: false,
  };
}

export function setCallRecordingPolicy(state: CallRecordingState, enabled: boolean): void {
  state.enabledByPolicy = enabled === true;
}

function pickMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const candidate of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return '';
}

export function canRecordCall(state: CallRecordingState): boolean {
  if (!state.enabledByPolicy) return false;
  if (typeof window === 'undefined') return false;
  if (typeof window.MediaRecorder === 'undefined') return false;
  const ctorAny = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  if (!ctorAny.AudioContext && !ctorAny.webkitAudioContext) return false;
  return true;
}

function ensureAudioGraph(state: CallRecordingState): void {
  if (state.audioContext && state.destination) return;
  const ctorAny = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = ctorAny.AudioContext ?? ctorAny.webkitAudioContext;
  if (!Ctor) return;
  state.audioContext = new Ctor();
  state.destination = state.audioContext.createMediaStreamDestination();
}

/**
 * Attach a MediaStream (mic or remote peer track) to the mixing destination.
 * `key` is a stable label like "local" / "remote" used to dedupe attaches.
 */
export function attachStreamToRecording(
  state: CallRecordingState,
  stream: MediaStream | null | undefined,
  key: string,
): boolean {
  if (!canRecordCall(state)) return false;
  if (!stream || !key) return false;

  ensureAudioGraph(state);
  if (!state.audioContext || !state.destination) return false;
  if (state.streamSources[key]) return true;

  const tracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
  if (!tracks || tracks.length === 0) return false;

  try {
    const source = state.audioContext.createMediaStreamSource(stream);
    source.connect(state.destination);
    state.streamSources[key] = source;
    return true;
  } catch {
    return false;
  }
}

export function startCallRecording(state: CallRecordingState): boolean {
  if (!canRecordCall(state)) return false;
  if (state.mediaRecorder || !state.destination) return false;

  const destinationTracks = state.destination.stream?.getAudioTracks?.() ?? [];
  if (destinationTracks.length === 0) return false;

  const mimeType = pickMimeType();
  const options = mimeType ? { mimeType } : undefined;
  const recorder = new window.MediaRecorder(state.destination.stream, options);
  state.mediaRecorder = recorder;
  state.mimeType = mimeType || 'audio/webm';
  state.chunks = [];
  state.startedAt = new Date().toISOString();

  recorder.ondataavailable = (event) => {
    if (event?.data && event.data.size > 0) {
      state.chunks.push(event.data);
    }
  };
  recorder.start(1000);
  return true;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface UploadPayloadBase {
  roomId: string;
  accountId?: string | null;
  callMode: 'NORMAL' | 'SILENT_LISTEN';
  initiatedBy?: string;
  peerUserId?: string;
  operatorUserId?: string;
  startedAt?: string;
}

export interface UploadResult {
  ok: boolean;
  error?: string;
  recordingId?: string;
  bytes?: number;
}

/**
 * Stops the active MediaRecorder, waits for the final chunk, base64-encodes
 * the blob, and uploads via `call:recording:upload` socket event. The server
 * returns `{ ok, recordingId, s3Key, bytes }`.
 */
export async function stopCallRecordingAndUpload(
  state: CallRecordingState,
  socket: Socket,
  payloadBase: UploadPayloadBase,
): Promise<UploadResult> {
  if (!state.mediaRecorder || state.isUploading) return { ok: false, error: 'NO_ACTIVE_RECORDING' };
  state.isUploading = true;
  const recorder = state.mediaRecorder;

  const result = await new Promise<UploadResult>((resolve) => {
    recorder.onstop = async () => {
      try {
        const blob = new Blob(state.chunks, { type: state.mimeType || 'audio/webm' });
        if (!blob || blob.size <= 0) {
          resolve({ ok: false, error: 'EMPTY_RECORDING' });
          return;
        }
        const audioBase64 = await blobToDataUrl(blob);
        const endedAt = new Date().toISOString();
        const durationSec = payloadBase.startedAt
          ? Math.max(
              0,
              Math.round(
                (new Date(endedAt).getTime() - new Date(payloadBase.startedAt).getTime()) / 1000,
              ),
            )
          : 0;

        socket.emit(
          'call:recording:upload',
          {
            ...payloadBase,
            startedAt: payloadBase.startedAt || state.startedAt,
            endedAt,
            durationSec,
            mimeType: state.mimeType || 'audio/webm',
            audioBase64,
          },
          (ack: { ok?: boolean; error?: string; recordingId?: string; bytes?: number }) => {
            if (ack?.ok) {
              resolve({ ok: true, recordingId: ack.recordingId, bytes: ack.bytes });
              return;
            }
            resolve({ ok: false, error: ack?.error || 'UPLOAD_FAILED' });
          },
        );
      } catch (err) {
        resolve({ ok: false, error: String((err as Error)?.message ?? err ?? 'UPLOAD_FAILED') });
      }
    };
    recorder.onerror = (ev) => {
      resolve({ ok: false, error: String((ev as unknown as { error?: Error })?.error?.message ?? 'RECORDER_ERROR') });
    };
    try {
      recorder.stop();
    } catch (err) {
      resolve({ ok: false, error: String((err as Error)?.message ?? 'RECORDER_STOP_FAILED') });
    }
  });

  resetCallRecordingState(state);
  return result;
}

export function resetCallRecordingState(state: CallRecordingState): void {
  for (const key of Object.keys(state.streamSources)) {
    try {
      state.streamSources[key]?.disconnect?.();
    } catch {
      /* noop */
    }
  }
  try {
    state.destination?.disconnect?.();
  } catch {
    /* noop */
  }
  try {
    state.audioContext?.close?.();
  } catch {
    /* noop */
  }
  state.mediaRecorder = null;
  state.mimeType = '';
  state.chunks = [];
  state.startedAt = null;
  state.audioContext = null;
  state.destination = null;
  state.streamSources = {};
  state.isUploading = false;
}
