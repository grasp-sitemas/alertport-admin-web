'use client';

import { useTranslations } from 'next-intl';
import { Bell, CheckCircle2, Clock, XCircle, Cpu, UserCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/features/dashboard/kpi-card';
import { useDashboardData } from '@/features/dashboard/use-dashboard-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlertOccurrence } from '@/types/api';
import { OccurrenceStatusBadge } from '@/components/shared/status-badge';

export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const { occurrences, equipmentCount, collaboratorCount, isLoading } = useDashboardData();

  const occurrenceList = occurrences.data?.results || [];
  const pendingCount = occurrenceList.filter((o) => o.status === 'PENDING').length;
  const respondedCount = occurrenceList.filter((o) => o.status === 'RESPONDED').length;
  const missedCount = occurrenceList.filter((o) => o.status === 'MISSED').length;
  const totalCount = occurrences.data?.totalCount ?? occurrenceList.length;

  // Group occurrences by day for the simple chart
  const byDay = groupByDay(occurrenceList);
  const maxCount = Math.max(1, ...Object.values(byDay));
  const days = Object.keys(byDay).slice(-7);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t('auth.welcomeBack')}, ${user?.firstName || ''}`}
        description={t('dashboard.welcome')}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('dashboard.totalAlerts')}
          value={isLoading ? '—' : totalCount}
          icon={Bell}
          accent="brand"
          isLoading={isLoading}
          trend={t('dashboard.weekSummary')}
        />
        <KpiCard
          title={t('dashboard.pendingAlerts')}
          value={isLoading ? '—' : pendingCount}
          icon={Clock}
          accent="warning"
          isLoading={isLoading}
        />
        <KpiCard
          title={t('dashboard.respondedAlerts')}
          value={isLoading ? '—' : respondedCount}
          icon={CheckCircle2}
          accent="success"
          isLoading={isLoading}
        />
        <KpiCard
          title={t('dashboard.missedAlerts')}
          value={isLoading ? '—' : missedCount}
          icon={XCircle}
          accent="danger"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title={t('dashboard.activeEquipments')}
          value={isLoading ? '—' : equipmentCount.data?.totalCount ?? 0}
          icon={Cpu}
          accent="info"
          isLoading={isLoading}
        />
        <KpiCard
          title={t('dashboard.activeCollaborators')}
          value={isLoading ? '—' : collaboratorCount.data?.totalCount ?? 0}
          icon={UserCheck}
          accent="brand"
          isLoading={isLoading}
        />
      </div>

      {/* Chart + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              {t('dashboard.alertsByDay')}
            </CardTitle>
            <CardDescription>{t('dashboard.weekSummary')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {days.length > 0 ? (
                days.map((day) => {
                  const count = byDay[day] ?? 0;
                  const heightPct = (count / maxCount) * 100;
                  return (
                    <div key={day} className="flex flex-1 flex-col items-center gap-2 min-w-0">
                      <div className="w-full flex items-end h-full">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-500 hover:brightness-125"
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                          title={`${count} alerts`}
                        />
                      </div>
                      <div className="text-[10px] text-text-muted truncate w-full text-center">
                        {formatDayShort(day)}
                      </div>
                      <div className="text-xs font-semibold text-white">{count}</div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-text-muted w-full text-center">{t('common.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {occurrenceList.slice(0, 5).map((occ) => (
                <div
                  key={occ._id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {typeof occ.site === 'object' ? occ.site?.name : t('common.site')}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(occ.scheduledAt).toLocaleString()}
                    </p>
                  </div>
                  <OccurrenceStatusBadge status={occ.status} />
                </div>
              ))}
              {occurrenceList.length === 0 && (
                <p className="text-sm text-text-muted text-center py-8">{t('common.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function groupByDay(occurrences: AlertOccurrence[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const occ of occurrences) {
    const day = new Date(occ.scheduledAt).toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  // Ensure last 7 days are present
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (!(key in counts)) counts[key] = 0;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function formatDayShort(day: string): string {
  try {
    return new Date(day).toLocaleDateString(undefined, { weekday: 'short' });
  } catch {
    return day;
  }
}
