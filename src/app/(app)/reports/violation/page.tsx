'use client';

import { ShieldAlert } from 'lucide-react';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useViolationReport } from '@/features/reports/use-reports';
import {
  DeviceEventReportBody,
  type DeviceEventVariant,
} from '@/features/reports/device-event-report';

/**
 * Violação - eventos de violação física do dispositivo
 * (eventType 14). Backend slice:
 * `/api/reports/alertport/violation/v1/`.
 */
const variant: DeviceEventVariant = {
  slug: 'violation',
  totalIcon: ShieldAlert,
  fileName: 'violacoes',
  kpis: [
    { category: 'VIOLATION', labelKey: 'violations', accent: 'danger', icon: ShieldAlert },
  ],
  useReportHook: useViolationReport,
};

export default function ViolationReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <DeviceEventReportBody variant={variant} />
      </ModuleGuard>
    </RoleGuard>
  );
}
