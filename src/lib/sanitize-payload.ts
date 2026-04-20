/**
 * Recursively strips empty-string values from an object so the backend doesn't
 * try to cast `""` to a Mongoose ObjectId ref (which fails with
 * `CastError: Cast to ObjectId failed for value ""`).
 *
 * Rules:
 *   - `""`  (empty string)          → removed
 *   - `null`, `undefined`           → removed (avoid overriding existing data)
 *   - empty arrays                  → kept (callers may rely on the type)
 *   - nested objects                → recursed; if the result becomes empty,
 *                                     the whole key is removed
 *   - primitives (number, bool, 0)  → kept as-is, including `0` and `false`
 *
 * Safe to call with unknown input - non-object values are returned untouched.
 */
export function stripEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripEmpty(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === '' || v === null || v === undefined) continue;
      if (typeof v === 'object' && !Array.isArray(v) && v !== null && (v as object).constructor === Object) {
        const pruned = stripEmpty(v) as Record<string, unknown>;
        if (Object.keys(pruned).length > 0) out[k] = pruned;
        continue;
      }
      out[k] = stripEmpty(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Same as `stripEmpty`, but also normalizes digit-only fields (phone, document,
 * CEP) by removing masks. Call before sending a payload built from masked
 * inputs.
 */
export function sanitizeFormPayload<T extends Record<string, unknown>>(
  payload: T,
  digitOnlyFields: string[] = ['primaryPhone', 'secondaryPhone', 'document', 'cep'],
): T {
  const stripped = stripEmpty(payload) as Record<string, unknown>;
  for (const key of Object.keys(stripped)) {
    const v = stripped[key];
    if (digitOnlyFields.includes(key) && typeof v === 'string') {
      stripped[key] = v.replace(/\D/g, '');
    } else if (v && typeof v === 'object' && !Array.isArray(v) && (v as object).constructor === Object) {
      stripped[key] = sanitizeFormPayload(v as Record<string, unknown>, digitOnlyFields);
    }
  }
  return stripped as T;
}
