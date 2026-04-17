import { describe, expect, it } from 'vitest';
import { toMultipartFormData } from '@/lib/multipart-form-data';

/**
 * The multer ENOENT bug (empty Blob → disk write to ephemeral `uploads/`)
 * has hit us twice. These tests lock the invariant in place: the `file`
 * field must ONLY appear when a real File is provided.
 */
describe('toMultipartFormData', () => {
  it('does NOT append file when file is undefined', () => {
    const fd = toMultipartFormData({ name: 'foo' });
    const keys = Array.from(fd.keys());
    expect(keys).not.toContain('file');
    expect(keys).toEqual(['jsonData']);
  });

  it('does NOT append file when file is null', () => {
    const fd = toMultipartFormData({ name: 'foo' }, null);
    expect(Array.from(fd.keys())).not.toContain('file');
  });

  it('appends file when a real File is provided', () => {
    const file = new File(['abc'], 'avatar.png', { type: 'image/png' });
    const fd = toMultipartFormData({ name: 'foo' }, file);
    expect(fd.has('file')).toBe(true);
    const appended = fd.get('file');
    expect(appended).toBeInstanceOf(File);
    expect((appended as File).name).toBe('avatar.png');
  });

  it('serializes payload as JSON under `jsonData`', () => {
    const payload = { firstName: 'Ada', lastName: 'Lovelace' };
    const fd = toMultipartFormData(payload);
    expect(fd.get('jsonData')).toBe(JSON.stringify(payload));
  });

  it('serializes `null` payload safely', () => {
    const fd = toMultipartFormData(null);
    expect(fd.get('jsonData')).toBe('null');
  });

  it('never appends an empty Blob — this is the production regression', () => {
    // Guardrail: if a future refactor reintroduces `fd.append("file", new Blob([]))`
    // it would silently send a 0-byte file and the backend would 500 with ENOENT.
    const fd = toMultipartFormData({}, undefined);
    const file = fd.get('file');
    expect(file).toBeNull();
  });
});
