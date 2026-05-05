'use client';
export const dynamic = 'force-dynamic';

import { Power, PowerOff, ToggleRight } from 'lucide-react';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useEquipmentStatusReport } from '@/features/reports/use-reports';
import {
  DeviceEventReportBody,
  type DeviceEventVariant,
} from '@/features/reports/device-event-report';

/**
 * Equipamento Ligado/Desligado - eventos de power-on/off do
 * dispositivo (eventTypes 17 + 18). Backend slice:
 * `/api/reports/alertport/equipment-status/v1/`.
 */
const variant: DeviceEventVariant = {
  slug: 'equipment-status',
  totalIcon: ToggleRight,
  fileName: 'equipamento_status',
  kpis: [
    { category: 'TURNED_ON', labelKey: 'turnedOn', accent: 'success', icon: Power },
    { category: 'TURNED_OFF', labelKey: 'turnedOff', accent: 'warning', icon: PowerOff },
  ],
  useReportHook: useEquipmentStatusReport,
};

export default function EquipmentStatusReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <DeviceEventReportBody variant={variant} />
      </ModuleGuard>
    </RoleGuard>
  );
}
