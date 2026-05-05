'use client';
export const dynamic = 'force-dynamic';

import { RotateCcw } from 'lucide-react';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useRemoteRestartReport } from '@/features/reports/use-reports';
import {
  DeviceEventReportBody,
  type DeviceEventVariant,
} from '@/features/reports/device-event-report';

/**
 * Reiniciado Remotamente - reinícios disparados pela plataforma
 * (eventType 15). Backend slice:
 * `/api/reports/alertport/remote-restart/v1/`.
 */
const variant: DeviceEventVariant = {
  slug: 'remote-restart',
  totalIcon: RotateCcw,
  fileName: 'reinicio_remoto',
  kpis: [
    { category: 'REMOTE_RESTART', labelKey: 'restarts', accent: 'info', icon: RotateCcw },
  ],
  useReportHook: useRemoteRestartReport,
};

export default function RemoteRestartReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <DeviceEventReportBody variant={variant} />
      </ModuleGuard>
    </RoleGuard>
  );
}
