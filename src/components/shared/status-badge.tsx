'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { EntityStatus, OccurrenceStatus, TimeEntryType } from '@/types/api';

export function StatusBadge({ status }: { status: EntityStatus }) {
  const t = useTranslations();
  return (
    <Badge variant={status === 'ACTIVE' ? 'success' : 'muted'}>
      {status === 'ACTIVE' ? t('common.active') : t('common.archived')}
    </Badge>
  );
}

export function OccurrenceStatusBadge({ status }: { status: OccurrenceStatus }) {
  const t = useTranslations();
  const variants: Record<OccurrenceStatus, 'warning' | 'success' | 'danger'> = {
    PENDING: 'warning',
    RESPONDED: 'success',
    MISSED: 'danger',
  };
  const keys: Record<OccurrenceStatus, string> = {
    PENDING: 'alerts.pending',
    RESPONDED: 'alerts.responded',
    MISSED: 'alerts.missed',
  };
  return <Badge variant={variants[status]}>{t(keys[status])}</Badge>;
}

export function TimeEntryBadge({ type }: { type: TimeEntryType }) {
  const t = useTranslations();
  const variants: Record<TimeEntryType, 'success' | 'danger' | 'warning' | 'info'> = {
    CLOCK_IN: 'success',
    CLOCK_OUT: 'danger',
    BREAK_START: 'warning',
    BREAK_END: 'info',
  };
  const keys: Record<TimeEntryType, string> = {
    CLOCK_IN: 'attendance.clockIn',
    CLOCK_OUT: 'attendance.clockOut',
    BREAK_START: 'attendance.breakStart',
    BREAK_END: 'attendance.breakEnd',
  };
  return <Badge variant={variants[type]}>{t(keys[type])}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const t = useTranslations();
  const roleKeys: Record<string, string> = {
    SUPER_ADMIN_MASTER: 'roles.superAdminMaster',
    ADMIN_MASTER: 'roles.adminMaster',
    ADMIN: 'roles.admin',
    MANAGER: 'roles.manager',
    OPERATOR: 'roles.operator',
    AUDITOR: 'roles.auditor',
  };
  return <Badge variant="brand">{t(roleKeys[role] || role)}</Badge>;
}
