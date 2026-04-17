'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { RoleGuard } from '@/components/shared/role-guard';
import { CallRecordingsPanel } from '@/features/calls/call-recordings-panel';

export default function RecordingsPage() {
  const t = useTranslations();

  return (
    <RoleGuard
      roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}
    >
      <div className="space-y-6">
        <PageHeader
          title={t('calls.recordings.pageTitle')}
          description={t('calls.recordings.pageDescription')}
        />
        <Card>
          <CardContent className="pt-6">
            <CallRecordingsPanel limit={100} />
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
