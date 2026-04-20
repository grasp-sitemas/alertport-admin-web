import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}

export function formatEntityName(entity?: { name?: string } | null): string {
  return entity?.name ?? '-';
}

/**
 * Pulls an `_id` out of either a string ID or a populated entity object.
 * Used everywhere a user/company field can arrive in either shape depending
 * on the endpoint.
 */
export function extractId(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '_id' in v) {
    const id = (v as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}
