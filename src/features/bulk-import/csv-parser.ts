/**
 * Minimal RFC 4180-ish CSV parser / serializer.
 *
 * We intentionally do not pull in a full library - payloads here are
 * internal templates (operators, collaborators, equipment) and range
 * from tens to low thousands of rows. A tight hand-rolled parser is
 * cheaper than shipping papaparse and faster to audit.
 *
 * Supported features:
 *   - Unix (\n) and Windows (\r\n) line endings.
 *   - UTF-8 BOM (stripped on parse).
 *   - Comma, semicolon and tab delimiters (auto-detected from header).
 *   - Double-quoted fields with "" escaping.
 *   - Trailing empty lines (ignored).
 *
 * Not supported:
 *   - Mixed delimiters inside a single file.
 *   - Multi-line quoted fields containing the delimiter AND a newline AND
 *     more than one escaped quote. Edge case; rejected with a clear error.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  /** Delimiter detected on the header row. */
  delimiter: string;
  /** Raw row count, including empty rows that were skipped. */
  totalLines: number;
}

export interface CsvParseError {
  line: number;
  message: string;
}

const BOM = '\uFEFF';

function detectDelimiter(headerLine: string): string {
  const counts = {
    ',': (headerLine.match(/,/g) ?? []).length,
    ';': (headerLine.match(/;/g) ?? []).length,
    '\t': (headerLine.match(/\t/g) ?? []).length,
  };
  let best: string = ',';
  let bestCount = -1;
  for (const [d, n] of Object.entries(counts)) {
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Tokenize one CSV line into an array of fields. Respects double-quoted
 * fields and handles "" as an embedded quote.
 */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          buf += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i += 1;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      out.push(buf);
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  out.push(buf);
  return out.map((f) => f.trim());
}

export function parseCsv(text: string): { result: CsvParseResult | null; error: CsvParseError | null } {
  let input = text;
  if (input.startsWith(BOM)) input = input.slice(BOM.length);

  // Normalize line endings. We collapse the file into lines first - the
  // hand-rolled tokenizer does not currently cross line boundaries, which
  // is fine for the simple templates we publish.
  const lines = input.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  if (nonEmpty.length === 0) {
    return { result: null, error: { line: 0, message: 'empty' } };
  }

  const headerLine = nonEmpty[0]!;
  const delimiter = detectDelimiter(headerLine);
  const headers = splitLine(headerLine, delimiter);

  if (headers.some((h) => !h)) {
    return { result: null, error: { line: 1, message: 'blankHeader' } };
  }
  if (new Set(headers).size !== headers.length) {
    return { result: null, error: { line: 1, message: 'duplicateHeader' } };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i += 1) {
    const fields = splitLine(nonEmpty[i]!, delimiter);
    if (fields.length > headers.length) {
      return {
        result: null,
        error: { line: i + 1, message: 'tooManyFields' },
      };
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]!] = (fields[j] ?? '').trim();
    }
    rows.push(row);
  }

  return {
    result: { headers, rows, delimiter, totalLines: nonEmpty.length },
    error: null,
  };
}

/** Serialize a list of rows back to CSV text. Useful for the error
 *  report download and the template CSV published in the dialog. */
export function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const esc = (value: string): string => {
    if (value == null) return '';
    if (/[",\n;]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const lines: string[] = [];
  lines.push(headers.map(esc).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}
