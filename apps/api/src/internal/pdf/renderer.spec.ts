import { describe, expect, it, vi } from 'vitest';
import type { PdfNodeTree } from '../../../domain/pdf-templates/interface.js';
import { UnresolvedPlaceholderError } from '../templates/renderer/template-renderer.js';
import { buildPdfRenderer } from './renderer.js';

// Minimal 1x1 transparent PNG as base64 constant
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_BASE64, 'base64');

function extractPdfTexts(buffer: Buffer): string[] {
  const latin = buffer.toString('latin1');
  const tjMatches = [...latin.matchAll(/\[(.*?)\]\s*TJ/gs)];
  return tjMatches.map((m) =>
    [...m[1].matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((x) => Buffer.from(x[1], 'hex').toString('latin1'))
      .join(''),
  );
}

describe('PdfRenderer', () => {
  const dummyImageLoader = vi.fn().mockResolvedValue(TINY_PNG_BUFFER);

  it('output starts with %PDF and filled text values appear in the bytes while raw placeholders do not', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: '1',
          type: 'text',
          x: 50,
          y: 50,
          width: 200,
          height: 30,
          content: 'Hello {{name}}!',
          style: { fontSize: 14, bold: true, align: 'left', color: '#112233' },
        },
      ],
    };

    const pdfBuffer = await renderer.renderPdf({
      projectId: 'p-1',
      tree,
      row: { name: 'Alice' },
    });

    expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    const texts = extractPdfTexts(pdfBuffer);
    expect(texts).toContain('Hello Alice!');
    expect(texts.some((t) => t.includes('{{name}}'))).toBe(false);
  });

  it('table cells are filled and rendered', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: 'tbl-1',
          type: 'table',
          x: 10,
          y: 10,
          width: 300,
          height: 60,
          rows: [
            ['Header', 'Col2'],
            ['Val: {{amount}}', 'Static'],
          ],
          style: { fontSize: 10, headerBold: true, borderColor: '#333333' },
        },
      ],
    };

    const pdfBuffer = await renderer.renderPdf({
      projectId: 'p-1',
      tree,
      row: { amount: '500 USD' },
    });

    expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    const texts = extractPdfTexts(pdfBuffer);
    expect(texts).toContain('Header');
    expect(texts).toContain('Col2');
    expect(texts).toContain('Val: 500 USD');
    expect(texts).toContain('Static');
    expect(texts.some((t) => t.includes('{{amount}}'))).toBe(false);
  });

  it('renders enhanced table with columnAligns, columnWidths, headerFill, zebra striping, and boldRows', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: 'tbl-enhanced',
          type: 'table',
          x: 20,
          y: 20,
          width: 400,
          height: 100,
          rows: [
            ['Description', 'Rate', 'Amount'],
            ['Consulting', '150', '$1,500.00'],
            ['Development', '120', '$2,400.00'],
            ['Total', '', '$3,900.00'],
          ],
          columnAligns: ['left', 'center', 'right'],
          columnWidths: [3, 1, 2],
          headerFill: '#E8EEF5',
          zebra: true,
          boldRows: [3],
          style: { fontSize: 10, headerBold: true, borderColor: '#333333' },
        },
      ],
    };

    const pdfBuffer = await renderer.renderPdf({
      projectId: 'p-1',
      tree,
      row: {},
    });

    expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    const texts = extractPdfTexts(pdfBuffer);
    expect(texts).toContain('Description');
    expect(texts).toContain('Consulting');
    expect(texts).toContain('$1,500.00');
    expect(texts).toContain('Total');
    expect(texts).toContain('$3,900.00');

    // Verify PDF drawing stream contains the header fill color (#E8EEF5 -> in RGB 0.9098, 0.9333, 0.9608 or hex)
    const rawPdf = pdfBuffer.toString('latin1');
    // Check fill operator 'f' for background and RGB values for #E8EEF5
    expect(rawPdf).toMatch(/0\.9098\d*\s+0\.9333\d*\s+0\.9607\d*\s+scn\s+f/);
    // Check zebra striping fill (#F8FAFC: 0.9725, 0.9803, 0.9882)
    expect(rawPdf).toMatch(/0\.9725\d*\s+0\.9803\d*\s+0\.9882\d*\s+scn\s+f/);
  });

  it('divider and empty node list work', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: 'div-1',
          type: 'divider',
          x: 20,
          y: 100,
          width: 500,
          height: 2,
          style: { thickness: 2, color: '#FF0000' },
        },
      ],
    };

    const pdfBuffer = await renderer.renderPdf({
      projectId: 'p-1',
      tree,
      row: {},
    });
    expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');

    const emptyTreeBuffer = await renderer.renderPdf({
      projectId: 'p-1',
      tree: { page: { size: 'A4', margin: 0 }, nodes: [] },
      row: {},
    });
    expect(emptyTreeBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
  });

  it('missing value throws UnresolvedPlaceholderError', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: '1',
          type: 'text',
          x: 50,
          y: 50,
          width: 200,
          height: 30,
          content: 'Hello {{missingField}}!',
          style: { fontSize: 14, bold: false, align: 'left', color: '#000000' },
        },
      ],
    };

    await expect(
      renderer.renderPdf({
        projectId: 'p-1',
        tree,
        row: {},
      }),
    ).rejects.toThrow(UnresolvedPlaceholderError);
  });

  it('image node uses the loader and null image throws IMAGE_NOT_FOUND', async () => {
    const imageLoader = vi.fn().mockResolvedValueOnce(TINY_PNG_BUFFER).mockResolvedValueOnce(null);
    const renderer = buildPdfRenderer({ imageLoader });

    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes: [
        {
          id: 'img-1',
          type: 'image',
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          attachmentId: 'att-1',
        },
      ],
    };

    // First call succeeds
    const buf = await renderer.renderPdf({ projectId: 'p-1', tree, row: {} });
    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(imageLoader).toHaveBeenCalledWith('p-1', 'att-1');

    // Second call throws IMAGE_NOT_FOUND
    await expect(renderer.renderPdf({ projectId: 'p-1', tree, row: {} })).rejects.toMatchObject({
      status: 422,
      code: 'IMAGE_NOT_FOUND',
      message: 'Image attachment not found',
    });
  });

  it('200 nodes render in under 3 seconds', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const nodes: PdfNodeTree['nodes'] = [];
    for (let i = 0; i < 200; i++) {
      nodes.push({
        id: `node-${i}`,
        type: 'text',
        x: (i % 5) * 100,
        y: Math.floor(i / 5) * 15,
        width: 90,
        height: 14,
        content: `Item {{idx}}: ${i}`,
        style: { fontSize: 9, bold: false, align: 'left', color: '#000000' },
      });
    }
    const tree: PdfNodeTree = {
      page: { size: 'A4', margin: 0 },
      nodes,
    };

    const start = Date.now();
    const buf = await renderer.renderPdf({
      projectId: 'p-1',
      tree,
      row: { idx: 'row-num' },
    });
    const duration = Date.now() - start;

    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(duration).toBeLessThan(3000);
  });
});
