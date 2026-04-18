'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { Card, CardContent } from '@/components/ui/card';
import { RoleGuard } from '@/components/shared/role-guard';
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
 * Initial filter shape. `callMode=''` means "any" on the client side and is
 * dropped from the payload before hitting the socket. We default to the
 * SILENT_LISTEN mode because that's the primary flow that produces
 * recordings; operators can still switch to "Todas" or "NORMAL".
 */
const initialFilters: RecordingsPageFilters = {
  callMode: 'SILENT_LISTEN',
  startDate: '',
  endDate: '',
};

export default function RecordingsPage() {
  const t = useTranslations();
  // `useFilters` is untyped (Record<string, unknown>) so we cast at the read
  // boundary; the shape is fully owned by this page anyway.
  const { filters, setFilter, clearFilters } = useFilters({ initialFilters });
  const typedFilters = filters as RecordingsPageFilters;
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState<RecordingsPageFilters>(initialFilters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});

  const handleSearch = () => {
    setActiveFilters(typedFilters);
    setActiveHierarchy(hierarchy);
  };

  const handleClear = () => {
    clearFilters();
    setActiveFilters(initialFilters);
    setHierarchy({});
    setActiveHierarchy({});
  };

  // Compose the final filter we feed to the hook. Empty strings become
  // undefined so the hook's "only send keys the user set" rule kicks in.
  const recordingsFilter: RecordingsFilter = {
    limit: 100,
    ...(activeHierarchy.account ? { accountId: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { clientId: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { siteId: activeHierarchy.site } : {}),
    ...(activeFilters.callMode ? { callMode: activeFilters.callMode } : {}),
    ...(activeFilters.startDate ? { startDate: activeFilters.startDate } : {}),
    ...(activeFilters.endDate ? { endDate: activeFilters.endDate } : {}),
  };

  return (
    <RoleGuard
      roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}
    >
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
                { value: 'SILENT_LISTEN', label: t('calls.silentListen') },
                { value: 'NORMAL', label: t('calls.callNormal') },
              ],
            },
          ]}
          values={filters}
          onChange={setFilter}
          onSearch={handleSearch}
          onClear={handleClear}
        />

        <Card>
          <CardContent className="pt-6">
            <CallRecordingsPanel filter={recordingsFilter} hideTitle />
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
