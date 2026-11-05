import { describe, expect, it } from 'vitest';
import { validateNodes, type PdfNode } from './pdf-node.types';

const validTextNode: PdfNode = {
  id: 'text-1',
  type: 'text',
  x: 8,
  y: 8,
  width: 200,
  height: 40,
  content: 'Hello {{name}}',
  style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
};

describe('validateNodes', () => {
  it('accepts valid text, table, image, and divider nodes', () => {
    const nodes: PdfNode[] = [
      validTextNode,
      {
        id: 'table-1', type: 'table', x: 8, y: 60, width: 300, height: 100,
        rows: [['Name', 'Value'], ['{{name}}', 'Example']], columnAligns: ['left', 'right'],
        columnWidths: [2, 1], boldRows: [0], headerFill: '#EEEEEE', zebra: true,
        style: { fontSize: 10, headerBold: true, borderColor: '#CCCCCC' },
      },
      { id: 'image-1', type: 'image', x: 8, y: 170, width: 100, height: 100, attachmentId: 'attachment-1' },
      { id: 'divider-1', type: 'divider', x: 8, y: 280, width: 300, height: 1, style: { color: '#000000', thickness: 1 } },
    ];

    expect(validateNodes(nodes)).toEqual([]);
  });

  it('reports duplicate ids and geometry outside the A4 canvas', () => {
    const nodes = [
      validTextNode,
      { ...validTextNode, x: 400, id: 'text-1' },
      { ...validTextNode, id: 'outside', x: 500, width: 100 },
      { ...validTextNode, id: 'below-page', y: 840, height: 10 },
    ];

    const errors = validateNodes(nodes);
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'text-1', field: 'id' }),
      expect.objectContaining({ nodeId: 'outside', field: 'x' }),
      expect.objectContaining({ nodeId: 'below-page', field: 'y' }),
    ]));
  });

  it('rejects invalid field ranges, colors, and unsafe template syntax', () => {
    const errors = validateNodes([
      { ...validTextNode, id: 'bad-style', content: '{{#if name}}', style: { ...validTextNode.style, fontSize: 80, color: 'red' } },
      { ...validTextNode, id: 'triple', content: 'Value {{{name}}}' },
      { id: 'bad-divider', type: 'divider', x: 0, y: 0, width: 10, height: 1, style: { color: '#12', thickness: 11 } },
      { id: 'bad-image', type: 'image', x: 0, y: 0, width: 10, height: 10, attachmentId: '  ' },
    ]);

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'bad-style', field: 'content' }),
      expect.objectContaining({ nodeId: 'bad-style', field: 'style.fontSize' }),
      expect.objectContaining({ nodeId: 'bad-style', field: 'style.color' }),
      expect.objectContaining({ nodeId: 'triple', field: 'content' }),
      expect.objectContaining({ nodeId: 'bad-divider', field: 'style.thickness' }),
      expect.objectContaining({ nodeId: 'bad-image', field: 'attachmentId' }),
    ]));
  });

  it('validates table row shapes, optional column lengths, and bold row indices', () => {
    const errors = validateNodes([{
      id: 'bad-table', type: 'table', x: 0, y: 0, width: 200, height: 80,
      rows: [['A', 'B'], ['C']], columnAligns: ['left'], columnWidths: [1], boldRows: [2],
      style: { fontSize: 10, headerBold: false, borderColor: '#FFFFFF' },
    }]);

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'bad-table', field: 'rows' }),
      expect.objectContaining({ nodeId: 'bad-table', field: 'columnAligns' }),
      expect.objectContaining({ nodeId: 'bad-table', field: 'columnWidths' }),
      expect.objectContaining({ nodeId: 'bad-table', field: 'boldRows' }),
    ]));
  });

  it('rejects unknown node kinds and non-object values without throwing', () => {
    expect(validateNodes([null, 'text', { id: 'unknown', type: 'shape' }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: '', field: 'node' }),
      expect.objectContaining({ nodeId: '', field: 'node' }),
      expect.objectContaining({ nodeId: 'unknown', field: 'type' }),
    ]));
  });
});
