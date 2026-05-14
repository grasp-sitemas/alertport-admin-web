// API response contracts - mirrors existing backend exactly

export interface ApiPaginatedResponse<T> {
  status: number;
  results: T[];
  totalCount: number;
  page?: number;
  limit?: number;
}

export interface ApiSingleResponse<T> {
  status: number;
  result: T;
}

export interface ApiLoginResponse {
  status: number;
  result: User;
  token: string;
}

export interface ApiErrorResponse {
  status: number;
  messageId?: string;
  message?: string;
}

export interface PaginationParams {
  skip: number; // 1-indexed page number (legacy contract)
  limit: number;
  isSortByStartDate?: boolean;
}

export interface FilterParams extends PaginationParams {
  account?: string;
  client?: string;
  site?: string;
  name?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

// ─── Auth ──────────────────────────────────────────────────────

export interface LoginRequest {
  email?: string;
  username?: string;
  login?: string;
  password: string;
}

// ─── User ──────────────────────────────────────────────────────

export type UserSubtype =
  | 'SUPER_ADMIN_MASTER'
  | 'ADMIN_MASTER'
  | 'ADMIN'
  | 'MANAGER'
  | 'OPERATOR'
  | 'AUDITOR';

export type EntityStatus = 'ACTIVE' | 'ARCHIVED';

export interface CompanyUser {
  _id?: string;
  subtype: UserSubtype;
  status: EntityStatus;
  company?: {
    typeService?: string[];
  };
}

export interface Address {
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  ibge?: string;
  gia?: string;
  name?: string;
  // Legacy backend returns these as numbers but accepts strings too; keep both
  lat?: number | string;
  lng?: number | string;
}

export type CustomerUserSubtype = 'VIGILANT' | 'SUPERVISOR';

export interface CustomerUser {
  _id?: string;
  subtype: CustomerUserSubtype;
  status: EntityStatus;
  employeeCode?: string;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  username?: string;
  primaryPhone?: string;
  photoURL?: string;
  language?: 'pt' | 'en' | 'es' | 'ja' | 'zh';
  darkMode?: boolean;
  status: EntityStatus;
  // System user (admin) flavor
  companyUser?: CompanyUser;
  // Customer user (collaborator / vigilant) flavor - only present for USER-CUSTOMER records
  customerUser?: CustomerUser;
  account?: Company;
  client?: Company;
  site?: Company;
  accountTimezone?: string;
  address?: Address;
  type?: 'USER-COMPANY' | 'USER-CUSTOMER';
  createDate?: string;
  updateDate?: string;
  createdDate?: string; // legacy alias some endpoints use
  updatedDate?: string;
}

export interface UserFormData {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  primaryPhone?: string;
  photoURL?: string;
  password?: string;
  confirmPassword?: string;
  language?: string;
  status: EntityStatus;
  companyUser: {
    subtype: UserSubtype;
    status: EntityStatus;
    company?: string;
  };
  account?: string;
  client?: string;
  site?: string;
  address?: Address;
}

// ─── Company ───────────────────────────────────────────────────

export type CompanyType = 'ACCOUNT' | 'CLIENT' | 'SITE';

export interface Company {
  _id: string;
  name: string;
  fantasyName?: string;
  personType?: 'PHYSICAL' | 'LEGAL';
  document?: string;
  email?: string;
  primaryPhone?: string;
  /**
   * IANA timezone (e.g. "America/Sao_Paulo"). Stored by ms-user on the
   * Mongo `companies` document and echoed on the /me + filter responses.
   * The field is optional for legacy records that predate the signup
   * timezone step.
   */
  timezone?: string;
  status: EntityStatus;
  type?: CompanyType;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  address?: Address;
  typeService?: string[];
  logoURL?: string;
  createdDate?: string;
  updatedDate?: string;
  /**
   * Server-generated 6-char Crockford-base32 identifier (e.g. "A1B2C3").
   * Only present on Sites. Used as manual-entry fallback in alertport-app
   * when the QR camera is unavailable. Display format: "AP-{siteCode}".
   * Read-only — never sent in create/update payloads.
   */
  siteCode?: string;
}

export interface CompanyFormData {
  _id?: string;
  name: string;
  fantasyName?: string;
  personType?: 'PHYSICAL' | 'LEGAL';
  document?: string;
  email?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  timezone?: string;
  status: EntityStatus;
  type?: CompanyType;
  account?: string;
  client?: string;
  address?: Address;
  typeService?: string[];
  logoURL?: string;
  // Fields used by client/site forms
  owner?: string;
  enableFreePatrol?: boolean;
}

// ─── Equipment ─────────────────────────────────────────────────

export interface Equipment {
  _id: string;
  code: string;
  type?: string;
  brand?: string;
  status: EntityStatus;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  user?: string | null;
  hasImport?: boolean;
  companyLegacyParentId?: string;
  legacyId?: string;
  createDate?: string;
  updateDate?: string;
  // legacy aliases still present in some responses
  name?: string;
  model?: string;
  serialNumber?: string;
  createdDate?: string;
  updatedDate?: string;
  // GWRonda devices use uniqueId as the IMEI/SN identifier. Used by
  // formatDeviceLabel when equipment.code is absent.
  uniqueId?: string;
}

export interface EquipmentFormData {
  _id?: string;
  legacyId?: string;
  code: string;
  type?: string;
  brand?: string;
  account: string;
  client: string;
  site: string;
  user?: string;
  hasImport?: boolean;
  status: EntityStatus;
  companyLegacyParentId?: string;
}

// ─── Schedule / Alert Occurrence ───────────────────────────────

export type ScheduleFrequency =
  | 'NOT_REPEAT'
  | 'DAILY'
  | 'EVERY_OTHER_DAY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';
export type AlertType = 'FIXED' | 'RANDOM';
export type OccurrenceStatus = 'PENDING' | 'RESPONDED' | 'MISSED';

export interface AlertConfig {
  alertType: AlertType;
  fixedInterval?: number;
  durationMin?: number;
  volumeLevel?: number;
  randomMin?: number;
  randomMax?: number;
}

export interface AlertSchedule {
  _id: string;
  name: string;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  equipment?: string | Equipment;
  frequency: ScheduleFrequency;
  category: 'ALERT_CHECK';
  frequencyMonth?: { day?: string | number };
  frequencyYear?: { month?: string | number; day?: string | number };
  weeklyDays?: number[];
  beginDate: string;
  endDate?: string | null;
  beginHour: string;
  endHour: string;
  status: EntityStatus;
  alertConfig: AlertConfig;
  createdDate?: string;
  updatedDate?: string;
  // Appointment-shape fields returned by /api/schedules/appointments/filter/v2/
  start?: string;
  end?: string;
  startDate?: string;
  startHour?: string;
  id?: string;
  appointment?: { _id?: string; startDate?: string; start?: string };
}

export interface AlertScheduleFormData {
  _id?: string;
  name: string;
  account?: string;
  client?: string;
  site?: string;
  equipment?: string;
  frequency: ScheduleFrequency;
  category: 'ALERT_CHECK';
  frequencyMonth?: { day?: string | number };
  frequencyYear?: { month?: string | number; day?: string | number };
  weeklyDays?: number[];
  beginDate: string;
  endDate?: string | null;
  beginHour: string;
  endHour: string;
  status: EntityStatus;
  alertConfig: AlertConfig;
}

export interface AlertOccurrence {
  _id: string;
  schedule?: AlertSchedule;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  equipment?: string | Equipment;
  scheduledAt: string;
  status: OccurrenceStatus;
  respondedAt?: string;
  createdDate?: string;
}

// ─── Time Entry / Attendance ───────────────────────────────────

export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';

export interface TimeEntry {
  _id: string;
  user?: User;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  equipment?: string | Equipment;
  eventType: TimeEntryType;
  /** Present in legacy mapping; backend actually returns `createdAt`. Prefer `createdAt`. */
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  createdDate?: string;
  method?: 'PHOTO' | 'PIN';
  source?: 'SHIELDGO' | 'ALERTPORT';
  status?: EntityStatus;
}

// ─── Events / Patrol Actions ───────────────────────────────────

export type EventType =
  | 'SOS_ALERT'
  | 'INCIDENT'
  | 'CRASH'
  | 'LOWVOLTAGE'
  | 'CANCEL_PATROL'
  | 'FAILURE_PATROL'
  // AlertPort: criado pelo backend (ms-patrolhub) quando uma AlertOccurrence
  // expira sem ser atendida no device. Aparece no monitor e segue o mesmo
  // fluxo de attendance do SOS.
  | 'OCCURRENCE_MISSED';

// Attendance flag lifecycle as stored on the patrol-action itself (legacy contract).
export type AttendanceFlagStatus = 'IN_PROGRESS' | 'CLOSED';

// Status of an individual attendance record (created via POST /attendances/v1/).
export type AttendanceRecordStatus = 'ACTIVE' | 'ARCHIVED';

/**
 * Kept for backward compatibility with older call sites that still reference
 * the legacy union. New code should use AttendanceFlagStatus.
 */
export type AttendanceStatus = AttendanceFlagStatus | 'COMPLETED' | 'CANCELLED';

/**
 * `deviceInfo` on a PatrolAction identifies the AlertPort device that fired the
 * event. The `deviceId` here is the value the device registered with on the
 * socket (`user:register.userId`) - so it is the correct target for a WebRTC
 * call via `call:start.to`. Other ids on the event (user / equipment) do NOT
 * necessarily map to an online socket.
 */
export interface PatrolActionDeviceInfo {
  deviceId?: string;
  name?: string;
  model?: string;
  version?: string;
  geolocation?: { latitude?: number | string; longitude?: number | string };
}

export interface PatrolAction {
  _id: string;
  type: EventType;
  status: string;
  source?: string;
  eventCategory?: string;
  account?: string | Company;
  client?: string | Company;
  site?: string | Company;
  equipment?: string | Equipment;
  user?: User;
  vigilant?: User;
  event?: string | { _id: string };
  deviceInfo?: PatrolActionDeviceInfo;
  location?: { lat: number; lng: number };
  geolocation?: { latitude?: number | string; longitude?: number | string };
  notes?: string;
  attendance?: EventAttendance;
  createdDate?: string;
  date?: string;
  // GWRonda legacy markers. When present the action originated from the
  // SQL bridge (read-only devices). UI hides call buttons because legacy
  // hardware has no audio capability.
  legacyEventId?: string;
  legacyEventType?: number;
  legacyReaderCode?: string;
}

/**
 * The `attendance` flag embedded on a PatrolAction (NOT an individual attendance
 * record - for that see `AttendanceRecord`). Mirrors shieldgo-admin-web's
 * contract exactly: `isAttendance`, `openedDate`, `closedDate`, `status`.
 */
export interface EventAttendance {
  isAttendance?: boolean;
  openedDate?: string;
  closedDate?: string;
  operator?: string | User;
  status?: AttendanceFlagStatus;
  // Legacy aliases some callers still read
  _id?: string;
  patrolAction?: string;
  attendanceType?: string;
  notes?: string;
  startedAt?: string;
  closedAt?: string;
}

/**
 * One logged attendance entry created by the operator during the incident
 * (type + notes). Multiple records can exist per patrol-action.
 */
export interface AttendanceRecord {
  _id: string;
  account?: string;
  client?: string;
  site?: string;
  event?: string;
  patrolAction: string;
  type: string; // AttendanceType id (or canonical label)
  notes?: string;
  operator?: string | User;
  siteGroup?: string;
  createDate?: string;
  status: AttendanceRecordStatus;
}

export interface AttendanceType {
  _id: string;
  name: string;
  description?: string;
}

// ─── Helpers ───────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

export interface EquipmentBrand {
  _id: string;
  name: string;
}

export interface EquipmentType {
  _id: string;
  name: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
}
