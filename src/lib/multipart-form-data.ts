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
export function toMultipartFormData(payload: unknown, file?: File | null): FormData {
  const fd = new FormData();
  if (file) fd.append('file', file);
  fd.append('jsonData', JSON.stringify(payload));
  return fd;
}
