'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Styling primitives shared by every chart so the dashboard feels like a
 * single surface instead of a patchwork of recharts defaults.
 */
const AXIS_COLOR = 'rgba(255,255,255,0.35)';
const GRID_COLOR = 'rgba(255,255,255,0.06)';

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(15,15,17,0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  color: '#fff',
};

// ─── Events-per-day trend ─────────────────────────────────────────
export interface TrendPoint {
  day: string; // ISO yyyy-mm-dd
  count: number;
}

export function EventsTrendChart({ data, formatDay }: { data: TrendPoint[]; formatDay: (day: string) => string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="alertport-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(239,68,68)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="rgb(239,68,68)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          tickFormatter={formatDay}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(239,68,68,0.35)', strokeWidth: 1 }}
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatDay(String(label))}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="rgb(239,68,68)"
          strokeWidth={2}
          fill="url(#alertport-trend)"
          activeDot={{ r: 4, fill: '#fff', stroke: 'rgb(239,68,68)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Status breakdown donut ───────────────────────────────────────
export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const total = useMemo(() => data.reduce((acc, s) => acc + s.value, 0), [data]);

  if (total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-text-muted">
        —
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke="rgba(0,0,0,0)"
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => String(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-white font-heading">{total}</p>
      </div>
    </div>
  );
}

// ─── Top sites horizontal bar ────────────────────────────────────
export interface RankedSite {
  name: string;
  count: number;
  /** D3 (Flavio): breakdown por status — opcional para callers legados. */
  responded?: number;
  pending?: number;
  missed?: number;
}

/**
 * D3: cores fixas por status (verde / laranja / vermelho) — espelham a
 * paleta do donut de status para coerência visual.
 */
const STATUS_BAR_COLORS = {
  responded: 'rgb(16,185,129)',
  pending: 'rgb(245,158,11)',
  missed: 'rgb(239,68,68)',
} as const;

interface TopSitesBarsProps {
  data: RankedSite[];
  /**
   * Quando true, renderiza barra empilhada por status (verde/laranja/vermelho).
   * Quando false (default), mantém a barra única (comportamento legado).
   */
  stacked?: boolean;
  /** Labels traduzidos para os segmentos da legenda da barra empilhada. */
  labels?: { responded: string; pending: string; missed: string };
}

export function TopSitesBars({ data, stacked = false, labels }: TopSitesBarsProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-text-muted">
        —
      </div>
    );
  }
  const height = Math.max(240, data.length * 28 + 40);
  const showStacked =
    stacked &&
    data.some(
      (d) => d.responded !== undefined || d.pending !== undefined || d.missed !== undefined,
    );
  const respondedLabel = labels?.responded ?? 'Responded';
  const pendingLabel = labels?.pending ?? 'Pending';
  const missedLabel = labels?.missed ?? 'Missed';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
        barSize={18}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => String(v)}
        />
        {showStacked ? (
          <>
            <Bar
              dataKey="responded"
              name={respondedLabel}
              stackId="status"
              fill={STATUS_BAR_COLORS.responded}
              radius={[6, 0, 0, 6]}
            />
            <Bar
              dataKey="pending"
              name={pendingLabel}
              stackId="status"
              fill={STATUS_BAR_COLORS.pending}
            />
            <Bar
              dataKey="missed"
              name={missedLabel}
              stackId="status"
              fill={STATUS_BAR_COLORS.missed}
              radius={[0, 6, 6, 0]}
            />
          </>
        ) : (
          <Bar
            dataKey="count"
            fill="rgb(99,102,241)"
            radius={[0, 6, 6, 0]}
            label={{ position: 'right', fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
