'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { Card, CardContent } from '@/components/ui/card';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { CallRecordingsPanel } from '@/features/calls/call-recordings-panel';
import { useFilters } from '@/hooks/use-filters';
import type { RecordingsFilter } from '@/features/calls/use-call-recordings';

type RecordingsCallMode = '' | 'SILENT_LISTEN' | 'NORMAL';

interface RecordingsPageFilters extends Record<string, unknown> {
  callMode: RecordingsCallMode;
  startDate: string;
  endDate: string;
}

/**
 * Initial filters. All empty so the first fetch returns everything the
 * backend can see for this session (server-side scoped by accountId).
 *
 * Previously we defaulted callMode to SILENT_LISTEN, but that silently hid
 * NORMAL recordings uploaded by the shieldgo flow and caused confusion
 * ("as gravações sumiram"). The user can still filter to one mode via the
 * dropdown.
 */
const initialFilters: RecordingsPageFilters = {
  callMode: '',
  startDate: '',
  endDate: '',
};

export default function RecordingsPage() {
  const t = useTranslations();
  const { filters, setFilter, clearFilters } = useFilters({ initialFilters });
  const typedFilters = filters as RecordingsPageFilters;

  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});

  // Filters apply **live** - we used to mirror the shieldgo pattern of a
  // "Filtrar" button that commits filters via a separate `activeFilters`
  // state, but that added one more render cycle and a bug where the panel
  // briefly showed empty state between the initial fetch and the committed
  // fetch. Applying live means one source of truth and one fetch per real
  // filter change. The "Filtrar" button stays as a convenience (triggers a
  // refresh) and "Limpar filtros" resets state.
  const recordingsFilter: RecordingsFilter = useMemo(
    () => ({
      limit: 100,
      ...(hierarchy.account ? { accountId: hierarchy.account } : {}),
      ...(hierarchy.client ? { clientId: hierarchy.client } : {}),
      ...(hierarchy.site ? { siteId: hierarchy.site } : {}),
      ...(typedFilters.callMode ? { callMode: typedFilters.callMode } : {}),
      ...(typedFilters.startDate ? { startDate: typedFilters.startDate } : {}),
      ...(typedFilters.endDate ? { endDate: typedFilters.endDate } : {}),
    }),
    [
      hierarchy.account,
      hierarchy.client,
      hierarchy.site,
      typedFilters.callMode,
      typedFilters.startDate,
      typedFilters.endDate,
    ],
  );

  const handleClear = () => {
    clearFilters();
    setHierarchy({});
  };

  return (
    <RoleGuard
      roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}
    >
      <ModuleGuard moduleKey="RECORDINGS">
      <div className="space-y-6">
        <PageHeader
          title={t('calls.recordings.pageTitle')}
          description={t('calls.recordings.pageDescription')}
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[
            { key: 'startDate', labelKey: 'common.startDate', type: 'date' },
            { key: 'endDate', labelKey: 'common.endDate', type: 'date' },
            {
              key: 'callMode',
              labelKey: 'calls.recordings.mode',
              type: 'select',
              options: [
                { value: 'SILENT_LISTEN', label: t('calls.mode.silentListen') },
                { value: 'NORMAL', label: t('calls.mode.normal') },
              ],
            },
          ]}
          values={filters}
          onChange={setFilter}
          // Filters apply live; the search button is just a visual affordance.
          // We wire it to a no-op so the UI remains consistent with the other
          // CRUD pages.
          onSearch={() => {}}
          onClear={handleClear}
        />

        <Card>
          <CardContent className="pt-6">
            <CallRecordingsPanel filter={recordingsFilter} hideTitle />
          </CardContent>
        </Card>
      </div>
      </ModuleGuard>
    </RoleGuard>
  );
}
