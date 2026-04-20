'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { runExport, type ExportFormat, type ExportPayload } from './report-export';

interface Props<Row> {
  getPayload: () => ExportPayload<Row> | null;
  disabled?: boolean;
}

/**
 * Single export button with a 3-item dropdown (CSV / XLSX / PDF).
 *
 * Keeps page-level code short: each report page just supplies a
 * `getPayload()` callback that returns the current export shape.
 * Errors are surfaced via toast so the operator never sees a raw
 * thrown exception.
 */
export function ReportExportButton<Row>({ getPayload, disabled }: Props<Row>) {
  const t = useTranslations();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    const payload = getPayload();
    if (!payload) {
      toast.warning(t('reports.export.nothingToExport'));
      return;
    }
    setBusy(format);
    try {
      await runExport(format, payload);
      toast.success(t('reports.export.success'));
    } catch (err) {
      toast.error(t('reports.export.failed'));
      // Re-throw in dev so the console still shows the stack; tests
      // short-circuit on toast in jsdom.
      if (process.env.NODE_ENV === 'development') {
        console.error('[report-export]', err);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled || busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('reports.export.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => void run('xlsx')} disabled={busy !== null}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {t('reports.export.xlsx')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('csv')} disabled={busy !== null}>
          <FileText className="h-4 w-4 mr-2" />
          {t('reports.export.csv')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('pdf')} disabled={busy !== null}>
          <FileText className="h-4 w-4 mr-2" />
          {t('reports.export.pdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
