import type { EventType, PatrolAction } from '@/types/api';
import { formatDeviceLabel } from './device-label';
import {
  classifyAttendance,
  extractAttendanceOwner,
  type AttendanceState,
} from './attendance-state';

// AlertPort não rastreia rondas JWM (INCIDENT, CRASH, CANCEL_PATROL,
// FAILURE_PATROL), então esses tipos saem do dropdown de filtro. Eles
// permanecem na union EventType (backend ainda pode enviá-los) e nos
// metadados do card para renderização caso cheguem.
export const MONITOR_EVENT_TYPES: EventType[] = [
  'SOS_ALERT',
  'LOWVOLTAGE',
  'OCCURRENCE_MISSED',
  'DEVICE_AC_LOST',
  'DEVICE_AC_RESTORED',
  'DEVICE_BATTERY_LOW',
];

export const MONITOR_STATUS_VALUES: AttendanceState[] = [
  'AVAILABLE',
  'IN_PROGRESS_BY_ME',
  'IN_PROGRESS_BY_OTHER',
  'CLOSED',
];

/**
 * Categoria de alto nível do monitor — agrupa tipos detalhados em
 * buckets que o operador entende:
 *   - SOS: panic alerts (SOS_ALERT)
 *   - OCCURRENCE_MISSED: alertas de ocorrência não atendidos no device
 *   - POWER_EVENT: eventos de energia/bateria do device (perda/retorno de
 *     energia AC e bateria baixa)
 *   - TIME_TRACKING: registros de ponto (não são PatrolAction; gated
 *     pelo módulo TIME_ENTRIES)
 */
export type MonitorCategory = 'SOS' | 'OCCURRENCE_MISSED' | 'POWER_EVENT' | 'TIME_TRACKING';

export const MONITOR_CATEGORIES: MonitorCategory[] = [
  'SOS',
  'OCCURRENCE_MISSED',
  'POWER_EVENT',
  'TIME_TRACKING',
];

/**
 * Mapeia categoria → set de EventType. TIME_TRACKING não tem EventType
 * (é renderizado em outra coluna), mas a presença na categoria
 * controla se essa coluna aparece.
 */
const CATEGORY_TO_EVENT_TYPES: Record<MonitorCategory, EventType[]> = {
  SOS: ['SOS_ALERT'],
  OCCURRENCE_MISSED: ['OCCURRENCE_MISSED'],
  POWER_EVENT: ['DEVICE_AC_LOST', 'DEVICE_AC_RESTORED', 'DEVICE_BATTERY_LOW'],
  TIME_TRACKING: [],
};

/**
 * "In progress (either operator)" — a status group selectable from the
 * tag row that matches both IN_PROGRESS_BY_ME and IN_PROGRESS_BY_OTHER.
 * Kept separate from the single AttendanceState values so the existing
 * status dropdown (which selects one concrete state) is unaffected.
 */
export const IN_PROGRESS_GROUP = 'IN_PROGRESS' as const;
export type MonitorStatusFilter = AttendanceState | typeof IN_PROGRESS_GROUP | '';

export interface MonitorClientFilters {
  /** Free-text search, case-insensitive. Empty string matches everything. */
  q: string;
  /** Single event type or empty string for all. */
  type: EventType | '';
  /**
   * Attendance state, the IN_PROGRESS group (either operator) or empty
   * string for all.
   */
  status: MonitorStatusFilter;
  /** High-level category or empty string for all. */
  category: MonitorCategory | '';
}

/**
 * Quick-filter tags shown above the monitor list (replacing the old
 * Categoria dropdown). Single-select; clicking the active tag clears it.
 *   - SOS         → category 'SOS'
 *   - AVAILABLE   → attendance status AVAILABLE (disponível p/ atendimento)
 *   - IN_PROGRESS → either IN_PROGRESS_BY_ME or IN_PROGRESS_BY_OTHER
 */
export type MonitorTag = 'SOS' | 'AVAILABLE' | 'IN_PROGRESS';

export const MONITOR_TAGS: MonitorTag[] = ['SOS', 'AVAILABLE', 'IN_PROGRESS'];

/**
 * Translate a quick-filter tag into the `category` / `status` slice of
 * {@link MonitorClientFilters}. Reuses the existing filter primitives so
 * {@link filterMonitorEvents} keeps a single code path.
 */
export function tagToFilters(tag: MonitorTag | ''): {
  category: MonitorCategory | '';
  status: MonitorStatusFilter;
} {
  switch (tag) {
    case 'SOS':
      return { category: 'SOS', status: '' };
    case 'AVAILABLE':
      return { category: '', status: 'AVAILABLE' };
    case 'IN_PROGRESS':
      return { category: '', status: IN_PROGRESS_GROUP };
    default:
      return { category: '', status: '' };
  }
}

function asName(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return '';
  if (typeof obj !== 'object') return '';
  const anyObj = obj as { name?: unknown };
  return typeof anyObj.name === 'string' ? anyObj.name : '';
}

function buildHaystack(event: PatrolAction, typeLabel: string | undefined): string {
  const owner = extractAttendanceOwner(event.attendance);
  const parts = [
    formatDeviceLabel(event),
    event.notes,
    owner.name,
    typeLabel,
    asName(event.equipment),
    asName(event.site),
    asName(event.client),
    asName(event.account),
    typeof event.equipment === 'object' ? (event.equipment as { serial?: string })?.serial : '',
    typeof event.equipment === 'object' ? (event.equipment as { imei?: string })?.imei : '',
    event.deviceInfo?.deviceId,
    event.deviceInfo?.name,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Apply client-side Monitor filters to the list of events that came back
 * from the server. Server-side filters (hierarchy, date range) already
 * trimmed the result; this narrows further on type / attendance state /
 * free-text - all purely visual so toggling a filter never re-issues the
 * query.
 */
export function filterMonitorEvents(
  events: PatrolAction[],
  filters: MonitorClientFilters,
  currentUserId: string | undefined,
  typeLabelFor: (type: EventType) => string | undefined,
): PatrolAction[] {
  const q = filters.q.trim().toLowerCase();
  if (!filters.type && !filters.status && !filters.category && !q) return events;

  // Categoria → conjunto de EventTypes que essa categoria abrange.
  // TIME_TRACKING não casa nenhum PatrolAction (renderizado em outra
  // coluna), então retorna lista vazia quando selecionada — cards SOS/etc.
  // somem.
  const allowedTypesByCategory = filters.category
    ? new Set(CATEGORY_TO_EVENT_TYPES[filters.category])
    : null;

  const out: PatrolAction[] = [];
  for (const event of events) {
    if (allowedTypesByCategory && !allowedTypesByCategory.has(event.type)) continue;
    if (filters.type && event.type !== filters.type) continue;
    if (filters.status) {
      const state = classifyAttendance(event, currentUserId);
      if (filters.status === IN_PROGRESS_GROUP) {
        // "Em atendimento" tag — match either operator's claim.
        if (state !== 'IN_PROGRESS_BY_ME' && state !== 'IN_PROGRESS_BY_OTHER') continue;
      } else if (state !== filters.status) {
        continue;
      }
    }
    if (q) {
      const haystack = buildHaystack(event, typeLabelFor(event.type));
      if (!haystack.includes(q)) continue;
    }
    out.push(event);
  }
  return out;
}
