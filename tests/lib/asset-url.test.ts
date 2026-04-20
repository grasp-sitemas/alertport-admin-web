import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * `resolveAssetUrl` exists because the legacy backend persists photo/logo
 * paths as `/filemanager/photo/<file>.png` - relative. Without a prefix, the
 * browser fetches them from the Vercel origin and 404s. Every case here maps
 * to a real production scenario.
 */
describe('resolveAssetUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function load() {
    vi.doMock('@/config/env', () => ({
      env: { apiUrl: 'https://api-hml.shieldgo.com.br' },
    }));
    return (await import('@/lib/asset-url')).resolveAssetUrl;
  }

  it('prefixes relative paths with the API base', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('/filemanager/photo/abc.png')).toBe(
      'https://api-hml.shieldgo.com.br/filemanager/photo/abc.png',
    );
  });

  it('adds a leading slash if missing', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('filemanager/photo/abc.png')).toBe(
      'https://api-hml.shieldgo.com.br/filemanager/photo/abc.png',
    );
  });

  it('returns absolute HTTPS URLs unchanged', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
  });

  it('returns http URLs unchanged', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('http://localhost:3000/x.png')).toBe('http://localhost:3000/x.png');
  });

  it('returns data URLs unchanged', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('returns blob URLs unchanged (used by PhotoUpload preview)', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('blob:https://app/xxxx')).toBe('blob:https://app/xxxx');
  });

  it('returns empty string for null/undefined/empty input', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl(null)).toBe('');
    expect(resolveAssetUrl(undefined)).toBe('');
    expect(resolveAssetUrl('')).toBe('');
    expect(resolveAssetUrl('   ')).toBe('');
  });

  it('treats the legacy "https://" sentinel as empty', async () => {
    const resolveAssetUrl = await load();
    expect(resolveAssetUrl('https://')).toBe('');
  });

  it('strips a trailing slash from the base URL before joining', async () => {
    vi.resetModules();
    vi.doMock('@/config/env', () => ({
      env: { apiUrl: 'https://api-hml.shieldgo.com.br/' },
    }));
    const { resolveAssetUrl } = await import('@/lib/asset-url');
    expect(resolveAssetUrl('/filemanager/photo/x.png')).toBe(
      'https://api-hml.shieldgo.com.br/filemanager/photo/x.png',
    );
  });
});
