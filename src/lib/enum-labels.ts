export function normalizeEnumToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const token = value.trim().toUpperCase();
  return token.length > 0 ? token : undefined;
}

export function formatEnumLabel(
  value: unknown,
  labels: Record<string, string>,
  fallback = '-',
): string {
  const token = normalizeEnumToken(value);
  if (!token) return fallback;

  return labels[token] ?? token;
}
