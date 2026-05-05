'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  headerKey: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  /**
   * When true (default), the column header becomes clickable and toggles
   * client-side sort by the column's key. Set to `false` for action
   * columns where sorting makes no sense.
   */
  sortable?: boolean;
  /**
   * Optional accessor to derive the comparable value when the raw
   * `item[key]` lookup isn't enough (nested objects, computed fields).
   * Returning a string/number/Date works out of the box.
   */
  sortAccessor?: (item: T) => unknown;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type SortDir = 'asc' | 'desc';
interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Pull a sortable scalar out of a row. Falls back to:
 *  1. explicit `sortAccessor`
 *  2. dot-path read of `col.key` (e.g. `account.name`)
 *  3. `undefined` for unknown shapes (sorts last via `compareValues`)
 */
function readSortValue<T>(item: T, col: Column<T>): unknown {
  if (col.sortAccessor) return col.sortAccessor(item);
  const path = col.key.split('.');
  let cur: unknown = item;
  for (const seg of path) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function compareValues(a: unknown, b: unknown): number {
  // Push nullish to the end regardless of direction; flipping handled by caller.
  const aNil = a === null || a === undefined || a === '';
  const bNil = b === null || b === undefined || b === '';
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  // Try ISO date strings before falling through to localeCompare so that
  // `2026-05-04T22:30:00.000Z` sorts chronologically, not lexicographically.
  if (typeof a === 'string' && typeof b === 'string') {
    if (/\d{4}-\d{2}-\d{2}/.test(a) && /\d{4}-\d{2}-\d{2}/.test(b)) {
      const da = Date.parse(a);
      const db = Date.parse(b);
      if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  getRowKey,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  const t = useTranslations();
  const [sort, setSort] = useState<SortState | null>(null);

  const columnByKey = useMemo(() => {
    const map = new Map<string, Column<T>>();
    for (const c of columns) map.set(c.key, c);
    return map;
  }, [columns]);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columnByKey.get(sort.key);
    if (!col || col.sortable === false) return data;
    // Slice keeps the parent's array intact - we never mutate `data`.
    const arr = data.slice();
    arr.sort((a, b) => {
      const va = readSortValue(a, col);
      const vb = readSortValue(b, col);
      const cmp = compareValues(va, vb);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, sort, columnByKey]);

  const toggleSort = (col: Column<T>) => {
    if (col.sortable === false) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      // Third click clears, restoring the parent's original order.
      return null;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle || t('table.noData')} description={emptyDescription} />;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.08] hover:bg-transparent">
              {columns.map((col) => {
                const sortable = col.sortable !== false;
                const isActive = sort?.key === col.key;
                const ariaSort: React.AriaAttributes['aria-sort'] = isActive
                  ? sort?.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : sortable
                    ? 'none'
                    : undefined;
                return (
                  <TableHead key={col.key} className={col.className} aria-sort={ariaSort}>
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={cn(
                          'group text-text-secondary inline-flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold tracking-wide uppercase transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none',
                          isActive && 'text-white',
                        )}
                        aria-label={t('table.sortBy', { column: t(col.headerKey) })}
                      >
                        <span>{t(col.headerKey)}</span>
                        {isActive ? (
                          sort?.dir === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 opacity-90" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 opacity-90" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60" />
                        )}
                      </button>
                    ) : (
                      <span>{t(col.headerKey)}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item) => (
              <TableRow
                key={getRowKey(item)}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col items-center justify-between gap-4 px-2 sm:flex-row">
        <div className="text-text-secondary flex items-center gap-2 text-sm">
          <span>{t('common.showing')}</span>
          <span className="font-medium text-white">
            {Math.min((page - 1) * pageSize + 1, totalCount)}–
            {Math.min(page * pageSize, totalCount)}
          </span>
          <span>{t('common.of')}</span>
          <span className="font-medium text-white">{totalCount}</span>
          <span>{t('common.records')}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-sm">{t('table.rowsPerPage')}</span>
            <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-text-secondary px-2 text-sm">
              {t('table.page')} <span className="font-medium text-white">{page}</span>{' '}
              {t('table.of')} <span className="font-medium text-white">{totalPages}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
