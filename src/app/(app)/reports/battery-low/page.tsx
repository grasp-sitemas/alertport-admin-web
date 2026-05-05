'use client';
export const dynamic = 'force-dynamic';

import { BatteryLow, BatteryWarning } from 'lucide-react';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useBatteryLowReport } from '@/features/reports/use-reports';
import {
  DeviceEventReportBody,
  type DeviceEventVariant,
} from '@/features/reports/device-event-report';

/**
 * Bateria Baixa - eventos de baixa tensão / bateria fraca
 * (eventTypes 9 + 5). Backend slice:
 * `/api/reports/alertport/battery-low/v1/`.
 */
const variant: DeviceEventVariant = {
  slug: 'battery-low',
  totalIcon: BatteryLow,
  fileName: 'bateria_baixa',
  kpis: [
    { category: 'LOW_VOLTAGE', labelKey: 'lowVoltage', accent: 'warning', icon: BatteryWarning },
    { category: 'BATTERY_LOW', labelKey: 'batteryLow', accent: 'danger', icon: BatteryLow },
  ],
  useReportHook: useBatteryLowReport,
};

export default function BatteryLowReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <DeviceEventReportBody variant={variant} />
      </ModuleGuard>
    </RoleGuard>
  );
}
