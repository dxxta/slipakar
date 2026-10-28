import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../lib/app-error.js';
import { fileParser } from './file-parser.js';

const { parseDataFile } = fileParser;

const csv = (text: string, maxRows = 10) => parseDataFile({ buffer: Buffer.from(text), fileName: 'rows.csv', maxRows });
const json = (value: string, maxRows = 10) => parseDataFile({ buffer: Buffer.from(value), fileName: 'rows.json', maxRows });

async function xlsx(rows: unknown[][], maxRows = 10): ReturnType<typeof parseDataFile> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rows');
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return parseDataFile({ buffer: Buffer.from(buffer), fileName: 'rows.xlsx', maxRows });
}

async function rejectsCode(action: Promise<unknown>, code: string): Promise<void> {
  await expect(action).rejects.toMatchObject<Partial<AppError>>({ status: 400, code });
}

describe('parseDataFile CSV', () => {
  it('keeps header columns and fills short rows', async () => {
    await expect(csv('name,email,unused\nAda,ada@example.com\nBob,bob@example.com,yes')).resolves.toEqual({
      columns: ['name', 'email', 'unused'],
      rows: [{ name: 'Ada', email: 'ada@example.com', unused: '' }, { name: 'Bob', email: 'bob@example.com', unused: 'yes' }],
    });
  });
  it('accepts a header only and skips empty rows', async () => {
    expect((await csv('name,email\n')).rows).toEqual([]);
    expect((await csv('name,email\n\nAda,a@example.com\n,\n')).rows).toHaveLength(1);
  });
  it('rejects empty input, missing or duplicate headers, and excessive rows', async () => {
    await rejectsCode(csv(''), 'EMPTY_FILE');
    await rejectsCode(csv('\nAda'), 'NO_HEADER');
    await rejectsCode(csv('name,name\nAda,Bob'), 'DUPLICATE_COLUMN');
    await rejectsCode(csv('name\nAda\nBob', 1), 'TOO_MANY_ROWS');
  });
  it('rejects malformed CSV and wider rows without exposing cells', async () => {
    await rejectsCode(csv('name\n"private'), 'MALFORMED_FILE');
    const action = csv('name\nAda,private');
    await rejectsCode(action, 'MALFORMED_FILE');
    await expect(action).rejects.toThrow('Row 2');
  });
});

describe('parseDataFile JSON', () => {
  it('uses union keys in first-seen order and stringifies values', async () => {
    await expect(json('[{"name":"Ada","count":2},{"name":"Bob","active":true}]')).resolves.toEqual({
      columns: ['name', 'count', 'active'],
      rows: [{ name: 'Ada', count: '2', active: '' }, { name: 'Bob', count: '', active: 'true' }],
    });
  });
  it('rejects empty, headerless, excessive, and malformed input', async () => {
    await rejectsCode(json(''), 'EMPTY_FILE');
    await rejectsCode(json('[]'), 'EMPTY_FILE');
    await rejectsCode(json('[{}]'), 'NO_HEADER');
    await rejectsCode(json('[{"a":1},{"a":2}]', 1), 'TOO_MANY_ROWS');
    await rejectsCode(json('{bad'), 'MALFORMED_FILE');
    await rejectsCode(json('[{"a":{"nested":true}}]'), 'MALFORMED_FILE');
  });
});

describe('parseDataFile XLSX', () => {
  it('converts dates and formula cached results and fills short rows', async () => {
    await expect(xlsx([
      ['name', 'date', 'formula', 'unused'],
      ['Ada', new Date('2026-01-02T00:00:00.000Z'), { formula: '1+1', result: 2 }],
    ])).resolves.toEqual({
      columns: ['name', 'date', 'formula', 'unused'],
      rows: [{ name: 'Ada', date: '2026-01-02', formula: '2', unused: '' }],
    });
  });
  it('accepts header only and skips empty rows', async () => {
    expect((await xlsx([['name', 'email']])).rows).toEqual([]);
    expect((await xlsx([['name'], [], ['Ada']])).rows).toHaveLength(1);
  });
  it('rejects missing or duplicate headers and excessive rows', async () => {
    await rejectsCode(xlsx([]), 'NO_HEADER');
    await rejectsCode(xlsx([['', 'name'], ['Ada', 'x']]), 'NO_HEADER');
    await rejectsCode(xlsx([['name', 'name']]), 'DUPLICATE_COLUMN');
    await rejectsCode(xlsx([['name'], ['Ada'], ['Bob']], 1), 'TOO_MANY_ROWS');
  });
  it('rejects wider rows and malformed workbook bytes', async () => {
    await rejectsCode(xlsx([['name'], ['Ada', 'private']]), 'MALFORMED_FILE');
    await rejectsCode(parseDataFile({ buffer: Buffer.from('not a workbook'), fileName: 'rows.xlsx', maxRows: 10 }), 'MALFORMED_FILE');
  });
});

it('rejects unsupported extensions', async () => {
  await rejectsCode(parseDataFile({ buffer: Buffer.from('data'), fileName: 'rows.txt', maxRows: 10 }), 'UNSUPPORTED_TYPE');
});
