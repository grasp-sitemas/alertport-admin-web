/**
 * Client-side exports for the reports module.
 *
 * Three formats:
 *   - CSV  - native, no dependency, RFC 4180-ish quoting.
 *   - XLSX - SheetJS (`xlsx`), lazy-imported so it doesn't bloat
 *            the shell chunk for operators who never export.
 *   - PDF  - `jspdf` + `jspdf-autotable`, also lazy-imported. Layout
 *            is professional by default: title, date range, KPI
 *            block, tabulated rows, pagination footer.
 *
 * Each exporter takes a normalized `ExportPayload` so the report
 * pages don't need to know the format quirks. Returns a Blob-backed
 * File to the browser via a transient <a download>.
 */

export interface ExportColumn<Row> {
  header: string;
  /** Value for CSV/XLSX. Returning a Date produces an ISO string. */
  value: (row: Row) => string | number | Date | null | undefined;
}

export interface ExportKpi {
  label: string;
  value: string;
}

export interface ExportPayload<Row> {
  /** File prefix. We append a timestamp + extension. */
  fileName: string;
  /** Human-readable title for PDF header. */
  title: string;
  /** Shown below the title on the PDF, e.g. "01/04/2026 - 30/04/2026". */
  subtitle?: string;
  kpis?: ExportKpi[];
  columns: ExportColumn<Row>[];
  rows: Row[];
  generatedAt: string;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

function stampFileName(prefix: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}_${tag}.${ext}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before we revoke.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCellString(raw: string | number | Date | null | undefined): string {
  if (raw == null) return '';
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

function escapeCsv(cell: string): string {
  if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

// ── CSV ────────────────────────────────────────────────────────
export function exportCsv<Row>(payload: ExportPayload<Row>) {
  const lines: string[] = [];
  if (payload.kpis?.length) {
    for (const k of payload.kpis) {
      lines.push(`${escapeCsv(k.label)},${escapeCsv(k.value)}`);
    }
    lines.push('');
  }
  lines.push(payload.columns.map((c) => escapeCsv(c.header)).join(','));
  for (const row of payload.rows) {
    lines.push(
      payload.columns
        .map((c) => escapeCsv(toCellString(c.value(row))))
        .join(','),
    );
  }
  // BOM so Excel opens UTF-8 CSVs with accents correctly.
  const content = '\uFEFF' + lines.join('\r\n');
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), stampFileName(payload.fileName, 'csv'));
}

// ── XLSX ───────────────────────────────────────────────────────
export async function exportXlsx<Row>(payload: ExportPayload<Row>) {
  const XLSX = await import('xlsx');
  const headerRow = payload.columns.map((c) => c.header);
  const dataRows = payload.rows.map((row) =>
    payload.columns.map((c) => {
      const v = c.value(row);
      if (v instanceof Date) return v;
      return v ?? '';
    }),
  );
  const aoa: (string | number | Date)[][] = [];
  if (payload.kpis?.length) {
    for (const k of payload.kpis) aoa.push([k.label, k.value]);
    aoa.push([]);
  }
  aoa.push(headerRow);
  for (const r of dataRows) aoa.push(r);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Reasonable column widths (cap at 40 chars to keep things tidy).
  ws['!cols'] = payload.columns.map((c, colIdx) => {
    let max = c.header.length;
    for (const r of dataRows) {
      const cell = r[colIdx];
      const len =
        cell instanceof Date ? 20 : String(cell ?? '').length;
      if (len > max) max = len;
    }
    return { wch: Math.min(40, Math.max(10, max + 2)) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    stampFileName(payload.fileName, 'xlsx'),
  );
}

// ── PDF ────────────────────────────────────────────────────────
export async function exportPdf<Row>(payload: ExportPayload<Row>) {
  const { default: JsPDFCtor } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(payload.title, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  let y = 60;
  if (payload.subtitle) {
    doc.text(payload.subtitle, 40, y);
    y += 14;
  }
  doc.text(`Gerado em: ${new Date(payload.generatedAt).toLocaleString()}`, 40, y);
  y += 20;

  // KPI block
  if (payload.kpis?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(55);
    const perRow = 4;
    const cellW = (pageWidth - 80) / perRow;
    payload.kpis.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = 40 + col * cellW;
      const cellY = y + row * 46;
      doc.setDrawColor(220);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, cellY, cellW - 8, 40, 4, 4, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(k.label, x + 10, cellY + 14);
      doc.setFontSize(12);
      doc.setTextColor(15);
      doc.text(k.value, x + 10, cellY + 30);
    });
    const kpiRows = Math.ceil(payload.kpis.length / perRow);
    y += kpiRows * 46 + 10;
  }

  // Table
  const head = [payload.columns.map((c) => c.header)];
  const body = payload.rows.map((row) =>
    payload.columns.map((c) => {
      const v = c.value(row);
      if (v == null) return '';
      if (v instanceof Date) return v.toLocaleString();
      return String(v);
    }),
  );
  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: 40, right: 40 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      const footer = `${payload.title} · Página ${pageNum}`;
      doc.text(footer, data.settings.margin.left, doc.internal.pageSize.getHeight() - 16);
    },
  });

  const blob = doc.output('blob');
  downloadBlob(blob, stampFileName(payload.fileName, 'pdf'));
}

export async function runExport<Row>(
  format: ExportFormat,
  payload: ExportPayload<Row>,
): Promise<void> {
  if (format === 'csv') return exportCsv(payload);
  if (format === 'xlsx') return exportXlsx(payload);
  return exportPdf(payload);
}
