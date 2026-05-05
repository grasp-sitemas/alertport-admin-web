'use client';
export const dynamic = 'force-dynamic';

import { Plug, PowerOff, Power } from 'lucide-react';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { usePowerEventsReport } from '@/features/reports/use-reports';
import {
  DeviceEventReportBody,
  type DeviceEventVariant,
} from '@/features/reports/device-event-report';

/**
 * Perda e Restauração de Energia - eventos AC dos dispositivos
 * AlertPort (eventTypes 10 + 11). Backend slice:
 * `/api/reports/alertport/power-events/v1/`.
 */
const variant: DeviceEventVariant = {
  slug: 'power-events',
  totalIcon: Plug,
  fileName: 'energia_perda_restauracao',
  kpis: [
    { category: 'POWER_LOSS', labelKey: 'lost', accent: 'danger', icon: PowerOff },
    { category: 'POWER_RESTORED', labelKey: 'restored', accent: 'success', icon: Power },
  ],
  useReportHook: usePowerEventsReport,
};

export default function PowerEventsReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <DeviceEventReportBody variant={variant} />
      </ModuleGuard>
    </RoleGuard>
  );
}
