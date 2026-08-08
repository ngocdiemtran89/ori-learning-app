/**
 * RFC 4180 Compliant CSV Parser for Phase 3.5 Import Center
 * Supports quoted fields, quoted commas, quoted newlines, Vietnamese UTF-8, and formula sanitization.
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/**
 * Parse raw CSV string into headers and key-value row objects
 */
export function parseCsvContent(csvContent: string): ParsedCsvResult {
  const errors: string[] = [];
  if (!csvContent || !csvContent.trim()) {
    return { headers: [], rows: [], errors: ['File CSV rỗng hoặc không chứa dữ liệu.'] };
  }

  const rawMatrix: string[][] = [];
  let currentRecord: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Normalize BOM (Byte Order Mark) if present
  let cleanCsv = csvContent;
  if (cleanCsv.charCodeAt(0) === 0xfeff) {
    cleanCsv = cleanCsv.slice(1);
  }

  for (let i = 0; i < cleanCsv.length; i++) {
    const char = cleanCsv[i];
    const nextChar = cleanCsv[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("") -> single quote (")
          currentCell += '"';
          i++;
        } else {
          // End of quoted cell
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRecord.push(currentCell);
        currentCell = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip \n
        }
        currentRecord.push(currentCell);
        rawMatrix.push(currentRecord);
        currentRecord = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRecord.push(currentCell);
        rawMatrix.push(currentRecord);
        currentRecord = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push last cell & row if non-empty
  if (currentCell !== '' || currentRecord.length > 0) {
    currentRecord.push(currentCell);
    rawMatrix.push(currentRecord);
  }

  if (rawMatrix.length === 0) {
    return { headers: [], rows: [], errors: ['Không thể đọc dữ liệu CSV.'] };
  }

  // Header row
  const headers = rawMatrix[0].map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < rawMatrix.length; r++) {
    const cells = rawMatrix[r];
    // Skip empty lines
    if (cells.length === 1 && cells[0].trim() === '') continue;

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c];
      if (headerName) {
        let val = (cells[c] || '').trim();
        // Sanitize formula risks (=, +, -, @ leading chars)
        if (/^[=+\-@]/.test(val)) {
          val = val.slice(1).trim();
        }
        rowObj[headerName] = val;
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows, errors };
}
