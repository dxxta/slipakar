import { describe, expect, it } from 'vitest';
import { createPdfTemplatesDto, listPdfTemplatesQueryDto } from './dto.js';

describe('pdf-templates DTO validation', () => {
  it('validates listPdfTemplatesQueryDto defaults and inputs', () => {
    expect(listPdfTemplatesQueryDto.parse({})).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
    expect(
      listPdfTemplatesQueryDto.parse({
        page: '2',
        limit: '10',
        q: 'payslip',
        sortBy: 'name',
        sortDir: 'asc',
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      q: 'payslip',
      sortBy: 'name',
      sortDir: 'asc',
    });
  });
  const validTree = {
    page: { size: 'A4' as const, margin: 10 },
    nodes: [
      {
        id: 'node-1',
        type: 'text' as const,
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        content: 'Hello {{name}}',
        style: { fontSize: 12, bold: false, align: 'left' as const, color: '#000000' },
      },
    ],
  };

  it('accepts a valid payload', () => {
    const parsed = createPdfTemplatesDto.safeParse({ name: 'Invoice', nodeTree: validTree });
    expect(parsed.success).toBe(true);
  });

  it('accepts a sheet node and rejects an invalid sheet color', () => {
    const sheet = { id: 'sheet-1', type: 'sheet' as const, x: 0, y: 0, width: 100, height: 50, style: { color: '#E5E7EB' } };
    expect(createPdfTemplatesDto.safeParse({ name: 'Sheet', nodeTree: { ...validTree, nodes: [sheet] } }).success).toBe(true);
    const bad = { ...sheet, style: { color: 'gray' } };
    expect(createPdfTemplatesDto.safeParse({ name: 'Sheet', nodeTree: { ...validTree, nodes: [bad] } }).success).toBe(false);
  });

  it('rejects more than 200 nodes', () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({
      id: `node-${i}`,
      type: 'divider' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 1,
      style: { color: '#000000', thickness: 1 },
    }));

    const res = createPdfTemplatesDto.safeParse({
      name: 'Too many nodes',
      nodeTree: { page: { size: 'A4', margin: 10 }, nodes },
    });
    expect(res.success).toBe(false);
  });

  it('rejects duplicate node IDs', () => {
    const res = createPdfTemplatesDto.safeParse({
      name: 'Dup IDs',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          { id: 'same', type: 'divider', x: 0, y: 0, width: 10, height: 1, style: { color: '#000000', thickness: 1 } },
          { id: 'same', type: 'divider', x: 0, y: 10, width: 10, height: 1, style: { color: '#000000', thickness: 1 } },
        ],
      },
    });
    expect(res.success).toBe(false);
  });

  it('rejects nodes outside the page boundaries (x + width > 595 or y + height > 842)', () => {
    // Width overflow
    const resWidth = createPdfTemplatesDto.safeParse({
      name: 'Overflow width',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          { id: 'n1', type: 'divider', x: 500, y: 10, width: 100, height: 1, style: { color: '#000000', thickness: 1 } },
        ],
      },
    });
    expect(resWidth.success).toBe(false);

    // Height overflow
    const resHeight = createPdfTemplatesDto.safeParse({
      name: 'Overflow height',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          { id: 'n2', type: 'divider', x: 10, y: 800, width: 100, height: 50, style: { color: '#000000', thickness: 1 } },
        ],
      },
    });
    expect(resHeight.success).toBe(false);
  });

  it('rejects unsafe placeholder syntax in table cell or text content', () => {
    const resUnsafeText = createPdfTemplatesDto.safeParse({
      name: 'Unsafe text',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          {
            id: 'n1',
            type: 'text',
            x: 10,
            y: 10,
            width: 100,
            height: 20,
            content: 'Bad {{ nested {{oops}} }}',
            style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
          },
        ],
      },
    });
    expect(resUnsafeText.success).toBe(false);

    const resUnsafeTable = createPdfTemplatesDto.safeParse({
      name: 'Unsafe table',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          {
            id: 'n2',
            type: 'table',
            x: 10,
            y: 10,
            width: 200,
            height: 100,
            rows: [['Safe header'], ['Bad cell {{ incomplete']],
            style: { fontSize: 12, headerBold: true, borderColor: '#000000' },
          },
        ],
      },
    });
    expect(resUnsafeTable.success).toBe(false);
  });

  it('rejects table with unequal row lengths', () => {
    const res = createPdfTemplatesDto.safeParse({
      name: 'Unequal rows',
      nodeTree: {
        page: { size: 'A4', margin: 10 },
        nodes: [
          {
            id: 'tbl-1',
            type: 'table',
            x: 10,
            y: 10,
            width: 200,
            height: 100,
            rows: [
              ['col1', 'col2'],
              ['col1'], // missing col2
            ],
            style: { fontSize: 12, headerBold: true, borderColor: '#000000' },
          },
        ],
      },
    });
    expect(res.success).toBe(false);
  });

  describe('table node enhancements: columnAligns, columnWidths, headerFill, zebra, boldRows', () => {
    const baseTableNode = {
      id: 'tbl-enhanced',
      type: 'table' as const,
      x: 10,
      y: 10,
      width: 400,
      height: 120,
      rows: [
        ['Description', 'Qty', 'Price'],
        ['Item 1', '2', '$100.00'],
        ['Total', '2', '$100.00'],
      ],
      style: { fontSize: 10, headerBold: true, borderColor: '#cccccc' },
    };

    it('accepts valid table enhancements', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Enhanced table',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              columnAligns: ['left', 'center', 'right'],
              columnWidths: [3, 1, 2],
              headerFill: '#E8EEF5',
              zebra: true,
              boldRows: [2],
            },
          ],
        },
      });
      expect(res.success).toBe(true);
    });

    it('rejects columnAligns when length does not match column count', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Mismatch aligns',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              columnAligns: ['left', 'right'], // only 2 for 3 cols
            },
          ],
        },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message.includes('columnAligns'))).toBe(true);
      }
    });

    it('rejects columnWidths when length does not match column count', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Mismatch widths',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              columnWidths: [3, 1], // only 2 for 3 cols
            },
          ],
        },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message.includes('columnWidths'))).toBe(true);
      }
    });

    it('rejects columnWidths with non-positive numbers', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Zero or negative width',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              columnWidths: [3, 0, 2],
            },
          ],
        },
      });
      expect(res.success).toBe(false);
    });

    it('rejects invalid headerFill hex color', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Bad headerFill',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              headerFill: 'blue',
            },
          ],
        },
      });
      expect(res.success).toBe(false);
    });

    it('rejects boldRows when row index is outside row range', () => {
      const res = createPdfTemplatesDto.safeParse({
        name: 'Out of range bold row',
        nodeTree: {
          page: { size: 'A4', margin: 10 },
          nodes: [
            {
              ...baseTableNode,
              boldRows: [5], // rows has length 3 (indices 0..2)
            },
          ],
        },
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message.includes('boldRows'))).toBe(true);
      }
    });
  });
});
