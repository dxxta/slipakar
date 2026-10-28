import { extname } from 'node:path';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError } from '../../../lib/app-error.js'
import type { FileParserInterface, ParseDataFileInput, ParsedDataFile } from '../../../domain/uploads/interface.js';


function fileError(code: string, message: string): AppError {
  return new AppError(400, code, message);
}

function isEmptyRow(values: string[]): boolean {
  return values.every((value) => value.trim() === '');
}

function header(values: string[]): string[] {
  if (isEmptyRow(values) || values.some((value) => value.trim() === '')) {
    throw fileError('NO_HEADER', 'A complete header row is required');
  }
  const columns = values.map((value) => value.trim());
  if (new Set(columns).size !== columns.length) throw fileError('DUPLICATE_COLUMN', 'Duplicate header column');
  return columns;
}

// Keep wide-row handling here so the policy can be changed independently.
function assertNoExtraCells(values: string[], columnCount: number, rowNumber: number): void {
  if (values.slice(columnCount).some((value) => value.trim() !== '')) {
    throw fileError('MALFORMED_FILE', `Row ${rowNumber} has more cells than the header`);
  }
}

function tabularRows(records: string[][], maxRows: number): ParsedDataFile {
  const columns = header(records[0] ?? []);
  const rows: Record<string, string>[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const values = records[index];
    if (isEmptyRow(values)) continue;
    assertNoExtraCells(values, columns.length, index + 1);
    rows.push(Object.fromEntries(columns.map((column, position) => [column, values[position] ?? ''])));
    if (rows.length > maxRows) throw fileError('TOO_MANY_ROWS', 'Too many data rows');
  }
  return { columns, rows };
}

function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellString(value.result as ExcelJS.CellValue);
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    throw fileError('MALFORMED_FILE', 'Unsupported spreadsheet cell');
  }
  return String(value);
}

function parseJson(buffer: Buffer, maxRows: number): ParsedDataFile {
  const parsed: unknown = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed)) throw fileError('MALFORMED_FILE', 'JSON must be an array');
  if (parsed.length === 0) throw fileError('EMPTY_FILE', 'File has no data rows');
  const columns: string[] = [];
  const sourceRows: Record<string, string>[] = [];
  for (const entry of parsed) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw fileError('MALFORMED_FILE', 'JSON rows must be flat objects');
    }
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (value !== null && typeof value === 'object') throw fileError('MALFORMED_FILE', 'JSON rows must be flat objects');
      if (!columns.includes(key)) columns.push(key);
      row[key] = value === null ? '' : String(value);
    }
    if (!isEmptyRow(Object.values(row))) {
      sourceRows.push(row);
      if (sourceRows.length > maxRows) throw fileError('TOO_MANY_ROWS', 'Too many data rows');
    }
  }
  if (columns.length === 0) throw fileError('NO_HEADER', 'JSON objects need at least one key');
  return { columns, rows: sourceRows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? '']))) };
}

async function parseDataFile({ buffer, fileName, maxRows }: ParseDataFileInput): Promise<ParsedDataFile> {
  const extension = extname(fileName).toLowerCase();
  if (!['.csv', '.xlsx', '.json'].includes(extension)) throw fileError('UNSUPPORTED_TYPE', 'Unsupported file type');
  if (buffer.length === 0) throw fileError('EMPTY_FILE', 'File is empty');
  try {
    if (extension === '.json') return parseJson(buffer, maxRows);
    if (extension === '.csv') {
      const records = parse(buffer, { bom: true, relax_column_count: true, skip_empty_lines: false }) as string[][];
      return tabularRows(records, maxRows);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw fileError('NO_HEADER', 'First worksheet is missing');
    const records: string[][] = [];
    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const values: string[] = [];
      for (let column = 1; column <= row.cellCount; column += 1) values.push(cellString(row.getCell(column).value));
      records.push(values);
    }
    return tabularRows(records, maxRows);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw fileError('MALFORMED_FILE', 'File could not be parsed');
  }
}

export const fileParser: FileParserInterface = { parseDataFile };
