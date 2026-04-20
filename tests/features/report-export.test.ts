import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportCsv, type ExportPayload } from '@/features/reports/report-export';

// The CSV exporter is the only format we can test reliably in jsdom
// without heavy mocking (xlsx needs Uint8Array workers, jspdf needs a
// canvas). CSV is also the format the "fast" operator-export path
// relies on — quoting/escaping bugs there are the most common export
// regression in real-world dashboards.

interface Row {
  date: string;
  site: string;
  notes?: string;
  count: number;
}

const sample: ExportPayload<Row> = {
  fileName: 'test-report',
  title: 'Test Report',
  generatedAt: '2026-04-19T12:00:00Z',
  kpis: [
    { label: 'Total', value: '12' },
    { label: 'Taxa', value: '87.5%' },
  ],
  columns: [
    { header: 'Date', value: (r) => r.date },
    { header: 'Site', value: (r) => r.site },
    { header: 'Notes', value: (r) => r.notes ?? '' },
    { header: 'Count', value: (r) => r.count },
  ],
  rows: [
    { date: '2026-01-01', site: 'Hospital Brasil', count: 3, notes: 'Tudo ok' },
    { date: '2026-01-02', site: 'Posto 02', count: 1, notes: 'Contém, vírgula' },
    { date: '2026-01-03', site: 'Unidade "A"', count: 0, notes: 'Quebra\nde linha' },
  ],
};

describe('exportCsv', () => {
  let capturedBlob: Blob | null = null;
  let capturedFileName = '';

  beforeEach(() => {
    capturedBlob = null;
    capturedFileName = '';

    // We don't touch document.createElement (re-spying it across tests
    // leads to recursive original-vs-spy binding). Instead we intercept
    // three side-effects the exporter relies on:
    //   - URL.createObjectURL captures the Blob payload.
    //   - HTMLAnchorElement.prototype.click is made inert.
    //   - appendChild captures the anchor so we can read `download`.
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      capturedBlob = b as Blob;
      return 'blob:mock';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(document.body, 'appendChild').mockImplementation(function (this: HTMLElement, node) {
      if (node instanceof HTMLAnchorElement) {
        capturedFileName = node.download;
      }
      return node as never;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation(function (this: HTMLElement, node) {
      return node as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function readBlob(blob: Blob): Promise<string> {
    // jsdom Blob.text() is sometimes flaky; use arrayBuffer → TextDecoder.
    // `ignoreBOM: false` is explicit — without it TextDecoder strips the
    // BOM silently and our "starts with BOM" assertion fires negative.
    const buf = await blob.arrayBuffer();
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
  }

  it('prepends KPIs, a blank line, and a header row', async () => {
    exportCsv(sample);
    expect(capturedBlob).not.toBeNull();
    const text = await readBlob(capturedBlob!);
    // Strip the BOM first (content starts with \uFEFF so Excel opens
    // the CSV as UTF-8 even without a manifest). After the BOM we
    // expect: kpi1, kpi2, blank, header, row1, row2, row3.
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split(/\r\n/);
    expect(lines[0]).toBe('Total,12');
    expect(lines[1]).toBe('Taxa,87.5%');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('Date,Site,Notes,Count');
  });

  it('quotes values that contain commas, quotes, or newlines', async () => {
    exportCsv(sample);
    const text = await readBlob(capturedBlob!);
    expect(text).toContain('"Contém, vírgula"');
    expect(text).toContain('"Unidade ""A"""');
    expect(text).toContain('"Quebra\nde linha"');
  });

  it('emits the filename with the report prefix and a csv extension', () => {
    exportCsv(sample);
    expect(capturedFileName.startsWith('test-report_')).toBe(true);
    expect(capturedFileName.endsWith('.csv')).toBe(true);
  });

  it('writes numeric values without quoting when safe', async () => {
    exportCsv(sample);
    const text = await readBlob(capturedBlob!);
    // Row 0: count=3 should appear unquoted after the "Tudo ok" notes.
    expect(text).toMatch(/Hospital Brasil,Tudo ok,3\b/);
  });
});
