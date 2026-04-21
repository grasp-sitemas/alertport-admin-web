'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { parseCsv, toCsv } from './csv-parser';

/**
 * Rough shape of one "parsed + validated" row before we hand it to the
 * backend create function. Generic over the concrete payload type each
 * caller sends.
 */
export interface BulkImportPreparedRow<T> {
  /** 1-based line number inside the CSV (for the error report). */
  line: number;
  /** Raw parsed row - used when re-emitting the error report. */
  raw: Record<string, string>;
  /** Either a ready-to-send payload OR a localized error message. */
  outcome:
    | { kind: 'ok'; payload: T }
    | { kind: 'error'; message: string };
}

/**
 * Config a caller passes to `BulkImportDialog`. Keeps the dialog fully
 * generic so we can reuse it for operators, collaborators, equipment
 * and anything else with a "create one" backend endpoint.
 */
export interface BulkImportConfig<T> {
  /** i18n key or literal for the dialog title. */
  title: string;
  /** Short explainer shown under the title. */
  description: string;
  /** CSV column headers published to the user (the template). */
  templateHeaders: string[];
  /** One example row users can fill in. */
  templateSample: Record<string, string>;
  /** Filename for the "download template" button. */
  templateFileName: string;
  /**
   * Convert a parsed CSV row into a payload for the create call, or
   * return a localized error message describing what's wrong. The
   * helper runs for every row during "Preview" so the operator sees
   * all validation errors up-front before firing any network call.
   */
  parseRow: (row: Record<string, string>) => { kind: 'ok'; payload: T } | { kind: 'error'; message: string };
  /**
   * Called once per valid row. Should POST to the backend and throw
   * on failure; the dialog handles catching and surfacing the error
   * alongside the row.
   */
  createRow: (payload: T) => Promise<unknown>;
}

interface Props<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BulkImportConfig<T>;
  /** Called after at least one successful import so the parent can
   *  invalidate lists. */
  onImported?: () => void;
}

/**
 * Slot between imports to give the backend (and the DB) room to
 * breathe. 80 ms is big enough to dissuade rate-limiters without
 * making 100-row imports feel slow.
 */
const IMPORT_SLOT_MS = 80;

interface RowResult {
  line: number;
  status: 'ok' | 'error';
  error?: string;
  raw: Record<string, string>;
}

export function BulkImportDialog<T>({ open, onOpenChange, config, onImported }: Props<T>) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<BulkImportPreparedRow<T>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<RowResult[] | null>(null);

  const reset = useCallback(() => {
    setFileName(null);
    setPrepared(null);
    setParseError(null);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (importing) return; // don't close mid-import
      reset();
      onOpenChange(false);
    },
    [importing, onOpenChange, reset],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setParseError(null);
      setResults(null);
      setPrepared(null);
      try {
        const text = await file.text();
        const { result, error } = parseCsv(text);
        if (!result || error) {
          setParseError(
            error
              ? t(`bulkImport.parseError.${error.message}`, { line: error.line })
              : t('bulkImport.parseError.empty'),
          );
          return;
        }
        // Header contract: we expect the template headers. Extra columns
        // are tolerated (callers should ignore them); missing headers are
        // a hard stop because parseRow would silently produce undefined.
        const missing = config.templateHeaders.filter((h) => !result.headers.includes(h));
        if (missing.length > 0) {
          setParseError(t('bulkImport.parseError.missingHeaders', { headers: missing.join(', ') }));
          return;
        }
        const rows: BulkImportPreparedRow<T>[] = result.rows.map((raw, idx) => ({
          line: idx + 2, // +1 for header, +1 for 1-indexed
          raw,
          outcome: config.parseRow(raw),
        }));
        setPrepared(rows);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : t('bulkImport.parseError.empty'));
      }
    },
    [config, t],
  );

  const handleImport = useCallback(async () => {
    if (!prepared) return;
    const validRows = prepared.filter((r) => r.outcome.kind === 'ok');
    if (validRows.length === 0) {
      toast.error(t('bulkImport.noValidRows'));
      return;
    }
    setImporting(true);
    setProgress({ done: 0, total: validRows.length });
    const acc: RowResult[] = prepared
      .filter((r) => r.outcome.kind === 'error')
      .map((r) => ({
        line: r.line,
        status: 'error' as const,
        error: r.outcome.kind === 'error' ? r.outcome.message : '',
        raw: r.raw,
      }));

    let done = 0;
    for (const row of validRows) {
      if (row.outcome.kind !== 'ok') continue;
      try {
        await config.createRow(row.outcome.payload);
        acc.push({ line: row.line, status: 'ok', raw: row.raw });
      } catch (err) {
        const msg = extractErrorMessage(err) || t('notifications.errorOccurred');
        acc.push({ line: row.line, status: 'error', error: msg, raw: row.raw });
      }
      done += 1;
      setProgress({ done, total: validRows.length });
      if (done < validRows.length) {
        await new Promise((resolve) => setTimeout(resolve, IMPORT_SLOT_MS));
      }
    }

    acc.sort((a, b) => a.line - b.line);
    setResults(acc);
    setImporting(false);
    const okCount = acc.filter((r) => r.status === 'ok').length;
    if (okCount > 0) {
      toast.success(t('bulkImport.resultToast', { ok: okCount, total: acc.length }));
      onImported?.();
    } else {
      toast.error(t('bulkImport.allFailed'));
    }
  }, [prepared, config, t, onImported]);

  const handleDownloadTemplate = useCallback(() => {
    const csv = toCsv(config.templateHeaders, [config.templateSample]);
    downloadCsv(config.templateFileName, csv);
  }, [config.templateHeaders, config.templateSample, config.templateFileName]);

  const handleDownloadErrors = useCallback(() => {
    if (!results) return;
    const errors = results.filter((r) => r.status === 'error');
    if (errors.length === 0) return;
    const headers = [...config.templateHeaders, '__error__'];
    const rows = errors.map((r) => ({ ...r.raw, __error__: r.error ?? '' }));
    const csv = toCsv(headers, rows);
    const stem = config.templateFileName.replace(/\.csv$/i, '');
    downloadCsv(`${stem}-erros.csv`, csv);
  }, [results, config.templateFileName, config.templateHeaders]);

  const stats = useMemo(() => {
    if (!prepared) return { valid: 0, invalid: 0, total: 0 };
    const total = prepared.length;
    const invalid = prepared.filter((r) => r.outcome.kind === 'error').length;
    return { valid: total - invalid, invalid, total };
  }, [prepared]);

  const hasAnyRow = !!prepared && prepared.length > 0;
  const canImport = hasAnyRow && stats.valid > 0 && !importing && !results;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-brand-500" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download template + upload */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white mb-2">
              {t('bulkImport.step1')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                {t('bulkImport.downloadTemplate')}
              </Button>
              <span className="text-xs text-text-muted">
                {t('bulkImport.expectedHeaders')}: {config.templateHeaders.join(', ')}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white mb-2">
              {t('bulkImport.step2')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-4 w-4" />
                {fileName ? t('bulkImport.pickAnother') : t('bulkImport.pickFile')}
              </Button>
              {fileName && (
                <span className="text-xs text-text-secondary truncate max-w-[40ch]">
                  {fileName}
                </span>
              )}
            </div>
            {parseError && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {parseError}
              </p>
            )}
          </div>

          {/* Step 3: Preview / progress / results */}
          {hasAnyRow && !results && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{t('bulkImport.step3')}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">
                    {stats.valid} {t('bulkImport.valid')}
                  </span>
                  {stats.invalid > 0 && (
                    <span className="text-red-400">
                      {stats.invalid} {t('bulkImport.invalid')}
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                {prepared!.slice(0, 100).map((r) => (
                  <div key={r.line} className="flex items-start gap-2 py-1.5 text-xs">
                    {r.outcome.kind === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
                    )}
                    <span className="text-text-muted shrink-0">#{r.line}</span>
                    <span className="truncate text-text-secondary">
                      {Object.values(r.raw).slice(0, 3).join(' · ')}
                    </span>
                    {r.outcome.kind === 'error' && (
                      <span className="text-red-400 ml-auto">{r.outcome.message}</span>
                    )}
                  </div>
                ))}
                {prepared!.length > 100 && (
                  <p className="py-1.5 text-xs text-text-muted">
                    {t('bulkImport.truncatedPreview', { count: prepared!.length - 100 })}
                  </p>
                )}
              </div>
            </div>
          )}

          {importing && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('bulkImport.importing')} {progress.done}/{progress.total}
            </div>
          )}

          {results && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{t('bulkImport.result')}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">
                    {results.filter((r) => r.status === 'ok').length} {t('bulkImport.ok')}
                  </span>
                  <span className="text-red-400">
                    {results.filter((r) => r.status === 'error').length} {t('bulkImport.error')}
                  </span>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                {results.map((r) => (
                  <div key={r.line} className="flex items-start gap-2 py-1.5 text-xs">
                    <span
                      className={cn(
                        'inline-block h-2 w-2 rounded-full mt-1.5 shrink-0',
                        r.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400',
                      )}
                    />
                    <span className="text-text-muted shrink-0">#{r.line}</span>
                    <span className="truncate text-text-secondary">
                      {Object.values(r.raw).slice(0, 3).join(' · ')}
                    </span>
                    {r.error && <span className="text-red-400 ml-auto">{r.error}</span>}
                  </div>
                ))}
              </div>
              {results.some((r) => r.status === 'error') && (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={handleDownloadErrors}>
                    <Download className="h-4 w-4" />
                    {t('bulkImport.downloadErrors')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={importing}>
            <X className="h-4 w-4" />
            {results ? t('common.close') : t('common.cancel')}
          </Button>
          {!results && (
            <Button type="button" onClick={handleImport} disabled={!canImport}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('bulkImport.import')} {stats.valid > 0 ? `(${stats.valid})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { response?: { data?: { message?: string; messageId?: string } }; message?: string };
  const serverMsg = anyErr.response?.data?.message || anyErr.response?.data?.messageId;
  if (serverMsg) return String(serverMsg);
  if (anyErr.message) return anyErr.message;
  return null;
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
