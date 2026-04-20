/**
 * Audio-capture cross-browser invariants.
 *
 * The call feature must work on the top-8 browsers by global market
 * share: Chrome, Safari, Edge, Firefox, Samsung Internet, Opera, UC
 * Browser, Yandex/Mi. These tests simulate each browser's
 * MediaRecorder.isTypeSupported and assert that:
 *
 *  1. Safari gets MP4 (so its recording is playable on every browser).
 *  2. Chrome 119+ gets MP4/AAC (same reason).
 *  3. Firefox gets webm/opus (only thing it can record).
 *  4. Older Chrome/Edge without MP4 support still gets webm/opus.
 *  5. Ancient runtime without MediaRecorder returns '' (we log + warn).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectAudioCapture, pickSupportedMimeType } from '@/features/calls/use-call';

type Supported = Record<string, boolean>;

function installMediaRecorderStub(supported: Supported) {
  const Stub = function Stub(this: unknown) {
    // constructor is a no-op for these tests
  } as unknown as {
    (): void;
    new (): object;
    isTypeSupported: (t: string) => boolean;
  };
  Stub.isTypeSupported = (type: string) => !!supported[type];
  (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = Stub;
}

function clearMediaRecorder() {
  delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

beforeEach(() => {
  // Each test sets up its own environment; make sure the AudioContext
  // detection returns true by giving the window a shim.
  (window as unknown as { AudioContext?: unknown }).AudioContext = function () {} as unknown;
  (navigator as unknown as { mediaDevices?: unknown }).mediaDevices = {
    getUserMedia: () => Promise.resolve({} as MediaStream),
  };
});

afterEach(() => {
  clearMediaRecorder();
  vi.restoreAllMocks();
});

describe('pickSupportedMimeType', () => {
  it('Safari 14.1+ (desktop/iOS): returns audio/mp4;codecs=mp4a.40.2', () => {
    installMediaRecorderStub({
      'audio/mp4;codecs=mp4a.40.2': true,
      'audio/mp4': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('Chrome 119+ / Edge / Opera / Samsung: returns audio/mp4+AAC (plays on Safari too)', () => {
    installMediaRecorderStub({
      'audio/mp4;codecs=mp4a.40.2': true,
      'audio/mp4': true,
      'audio/webm;codecs=opus': true,
      'audio/webm': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('older Chrome/Edge/Samsung without MP4: falls back to webm/opus', () => {
    installMediaRecorderStub({
      'audio/webm;codecs=opus': true,
      'audio/webm': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('Firefox: falls back to webm/opus (Gecko supports both webm and ogg)', () => {
    installMediaRecorderStub({
      'audio/webm;codecs=opus': true,
      'audio/ogg;codecs=opus': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('ancient Firefox: only ogg available', () => {
    installMediaRecorderStub({
      'audio/ogg;codecs=opus': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/ogg;codecs=opus');
  });

  it('UC Browser on Android (Chromium fork): same path as Chrome', () => {
    installMediaRecorderStub({
      'audio/mp4;codecs=mp4a.40.2': true,
      'audio/webm;codecs=opus': true,
    });
    expect(pickSupportedMimeType()).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('no MediaRecorder support: returns empty string', () => {
    clearMediaRecorder();
    expect(pickSupportedMimeType()).toBe('');
  });

  it('isTypeSupported throws (broken Safari TP builds): keeps scanning', () => {
    const throwingStub = function () {} as unknown as {
      (): void;
      new (): object;
      isTypeSupported: (t: string) => boolean;
    };
    throwingStub.isTypeSupported = (t: string) => {
      if (t.startsWith('audio/mp4')) throw new Error('not supported');
      return t === 'audio/webm;codecs=opus';
    };
    (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = throwingStub;
    expect(pickSupportedMimeType()).toBe('audio/webm;codecs=opus');
  });
});

describe('detectAudioCapture', () => {
  it('labels Chrome/Edge/Opera/Samsung as blink', () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    );
    installMediaRecorderStub({ 'audio/mp4;codecs=mp4a.40.2': true });
    expect(detectAudioCapture().engine).toBe('blink');
  });

  it('labels Firefox as gecko', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0');
    installMediaRecorderStub({ 'audio/webm;codecs=opus': true });
    expect(detectAudioCapture().engine).toBe('gecko');
  });

  it('labels Safari as webkit', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    );
    installMediaRecorderStub({ 'audio/mp4;codecs=mp4a.40.2': true });
    expect(detectAudioCapture().engine).toBe('webkit');
  });

  it('returns all-false on ancient browsers without MediaRecorder', () => {
    setUserAgent('ancient');
    clearMediaRecorder();
    const cap = detectAudioCapture();
    expect(cap.mediaRecorder).toBe(false);
    expect(cap.preferredMimeType).toBe('');
  });

  it('surfaces preferredMimeType the UI can pre-validate against', () => {
    setUserAgent('Mozilla/5.0 Chrome/132.0.0.0');
    installMediaRecorderStub({
      'audio/mp4;codecs=mp4a.40.2': true,
      'audio/webm;codecs=opus': true,
    });
    expect(detectAudioCapture().preferredMimeType).toBe('audio/mp4;codecs=mp4a.40.2');
  });
});
