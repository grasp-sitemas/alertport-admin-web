/**
 * Shared helper for building multipart/form-data payloads for the legacy
 * `/api/{company,users}/formdata/v1/` endpoints.
 *
 * IMPORTANT: do NOT append `file` when there is no file. The API Gateway uses
 * `multer.array('file', 100)` — if we append an empty Blob, multer treats it
 * as a valid upload, tries to persist it to `uploads/<generated-name>`, and
 * blows up with `ENOENT` on containers where that directory is ephemeral
 * (Heroku). Shieldgo-admin-web relies on the implicit "undefined file" →
 * string coercion in the browser, which multer skips. We match that exact
 * behavior here by omitting the field entirely unless a real File is
 * provided.
 *
 * This bug has bitten us twice (company.service.ts first, then
 * users.service.ts). Centralizing the helper stops the third occurrence.
 */
export class EmptyFileUploadError extends Error {
  constructor() {
    super('empty.file.upload');
    this.name = 'EmptyFileUploadError';
  }
}

export function toMultipartFormData(payload: unknown, file?: File | null): FormData {
  const fd = new FormData();
  // Triple-gate guard against empty files:
  //   1. File exists at all (might be null/undefined)
  //   2. File has size > 0 (mobile emulators sometimes return size=0)
  //   3. Throw if a File was provided but is empty — so the caller can't
  //      silently ship a 500 to the user.
  if (file) {
    if (file.size === 0) {
      console.warn(
        '[toMultipartFormData] Rejected empty file upload:',
        file.name,
        file.type,
      );
      throw new EmptyFileUploadError();
    }
    fd.append('file', file);
  }
  fd.append('jsonData', JSON.stringify(payload));
  return fd;
}
