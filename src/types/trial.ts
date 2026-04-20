// Trial / Plan contracts - mirror the shieldgo-microservices backend shape.
// Keep these field names in sync with hp-shield-crud/services/trial/*.

export type TrialStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELED' | null;

export type TrialEvent =
  | 'CREATED'
  | 'EXTENDED'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'CANCELED'
  | 'RESTARTED';

export type PlanType = 'LEGACY' | 'FREE' | 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE' | string;

export type TrialBlockedReason =
  | 'TRIAL_EXPIRED'
  | 'TRIAL_LIMIT_REACHED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'READ_ONLY_MODE'
  | null;

export interface TrialLimits {
  users?: number;
  devices?: number;
  sites?: number;
  clients?: number;
  incidents?: number;
  integrations?: number;
  reportsPerMonth?: number;
  [key: string]: number | undefined;
}

export interface TrialUsage {
  users?: number;
  devices?: number;
  sites?: number;
  clients?: number;
  incidents?: number;
  [key: string]: number | undefined;
}

export interface TrialFeatures {
  users?: boolean;
  devices?: boolean;
  sites?: boolean;
  clients?: boolean;
  incidents?: boolean;
  integrations?: boolean;
  'reports.export'?: boolean;
  'monitor.realtime'?: boolean;
  chat?: boolean;
  'analytics.advanced'?: boolean;
  [key: string]: boolean | undefined;
}

export interface TrialContext {
  accountId: string | null;
  planType: PlanType;
  isTrial: boolean;
  trialStatus: TrialStatus;
  trialStartAt: string | null;
  trialEndAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  isReadOnly: boolean;
  features: TrialFeatures;
  limits: TrialLimits;
  usage: TrialUsage;
  blockedReason: TrialBlockedReason;
}

export interface PlanDefinition {
  planType: PlanType;
  label: string;
  features: TrialFeatures;
  limits: TrialLimits;
  trial: {
    enabled: boolean;
    durationDays?: number;
    maxExtensions?: number;
    extensionDays?: number;
  };
}

export interface TrialHistoryEntry {
  _id: string;
  company: string;
  event: TrialEvent;
  planType?: PlanType;
  previousPlanType?: PlanType;
  trialStartAt?: string;
  trialEndAt?: string;
  previousTrialEndAt?: string;
  daysAdded?: number;
  reason?: string;
  source?: 'USER' | 'JOB' | 'API' | 'SYSTEM';
  triggeredBy?: string;
  createDate: string;
}

/**
 * Resource keys accepted by canCreate() gating - matches backend plan-config.
 */
export type GatedResource = 'users' | 'devices' | 'sites' | 'clients' | 'incidents' | 'integrations';

/**
 * Feature keys accepted by canUseFeature() gating - matches backend plan-config.
 */
export type GatedFeature =
  | 'users'
  | 'devices'
  | 'sites'
  | 'clients'
  | 'incidents'
  | 'integrations'
  | 'reports.export'
  | 'monitor.realtime'
  | 'chat'
  | 'analytics.advanced';
