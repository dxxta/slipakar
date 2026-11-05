import { PLACEHOLDER_REGEX } from '@lokaslip/shared';

export const PDF_PAGE_WIDTH = 595;
export const PDF_PAGE_HEIGHT = 842;
export const PDF_PAGE_MARGIN_LIMITS = { min: 0, max: 100 } as const;

export const PDF_NODE_LIMITS = {
  id: { minLength: 1, maxLength: 64 },
  coordinate: { min: 0, max: 842 },
  dimension: { min: 1, max: 842 },
  nodeCount: { max: 200 },
  text: {
    content: { minLength: 1, maxLength: 5000 },
    fontSize: { min: 6, max: 72 },
  },
  image: { attachmentIdMinLength: 1 },
  table: {
    rowCount: { min: 1, max: 50 },
    columnCount: { min: 1, max: 12 },
    cell: { minLength: 0, maxLength: 500 },
    fontSize: { min: 6, max: 72 },
  },
  divider: { thickness: { min: 0.5, max: 10 } },
} as const;

export type PdfTextNode = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style: {
    fontSize: number;
    bold: boolean;
    align: 'left' | 'center' | 'right';
    color: string;
  };
};

export type PdfTableNode = {
  id: string;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rows: string[][];
  columnAligns?: Array<'left' | 'center' | 'right'>;
  columnWidths?: number[];
  headerFill?: string;
  zebra?: boolean;
  boldRows?: number[];
  style: {
    fontSize: number;
    headerBold: boolean;
    borderColor: string;
  };
};

export type PdfImageNode = {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  attachmentId: string;
};

export type PdfDividerNode = {
  id: string;
  type: 'divider';
  x: number;
  y: number;
  width: number;
  height: number;
  style: {
    color: string;
    thickness: number;
  };
};

export type PdfNode = PdfTextNode | PdfTableNode | PdfImageNode | PdfDividerNode;
export type PdfNodeType = PdfNode['type'];
export type PdfNodeTree = { page: { size: 'A4'; margin: number }; nodes: PdfNode[] };

export type PdfNodeValidationError = {
  nodeId: string;
  field: string;
  message: string;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addError(
  errors: PdfNodeValidationError[],
  nodeId: string,
  field: string,
  message: string,
): void {
  errors.push({ nodeId, field, message });
}

function validateNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  nodeId: string,
  field: string,
  errors: PdfNodeValidationError[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    addError(errors, nodeId, field, `Must be a number between ${minimum} and ${maximum}`);
    return false;
  }
  return true;
}

function validateColor(
  value: unknown,
  nodeId: string,
  field: string,
  errors: PdfNodeValidationError[],
): void {
  if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
    addError(errors, nodeId, field, 'Invalid hex color');
  }
}

function validateTemplate(
  value: unknown,
  minimum: number,
  maximum: number,
  nodeId: string,
  field: string,
  errors: PdfNodeValidationError[],
): void {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) {
    addError(errors, nodeId, field, `Must be a string between ${minimum} and ${maximum} characters`);
    return;
  }
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  const remainder = value.replace(regex, '');
  if (remainder.includes('{{') || remainder.includes('}}')) {
    addError(errors, nodeId, field, 'Only simple {{field_name}} placeholders are supported');
  }
}

function validateStyleObject(value: unknown, nodeId: string, field: string, errors: PdfNodeValidationError[]): RecordValue | null {
  if (!isRecord(value)) {
    addError(errors, nodeId, field, 'Must be an object');
    return null;
  }
  return value;
}

function validateNode(value: unknown, index: number, ids: Set<string>, errors: PdfNodeValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, '', 'node', 'Node must be an object');
    return;
  }

  const nodeId = typeof value['id'] === 'string' ? value['id'] : '';
  if (typeof value['id'] !== 'string' || value['id'].trim().length < PDF_NODE_LIMITS.id.minLength || value['id'].trim().length > PDF_NODE_LIMITS.id.maxLength) {
    addError(errors, nodeId, 'id', 'ID must be a non-empty string of at most 64 characters');
  }
  if (nodeId && ids.has(nodeId)) addError(errors, nodeId, 'id', `Duplicate node ID: ${nodeId}`);
  if (nodeId) ids.add(nodeId);

  const xValid = validateNumber(value['x'], PDF_NODE_LIMITS.coordinate.min, PDF_NODE_LIMITS.coordinate.max, nodeId, 'x', errors);
  const yValid = validateNumber(value['y'], PDF_NODE_LIMITS.coordinate.min, PDF_NODE_LIMITS.coordinate.max, nodeId, 'y', errors);
  const widthValid = validateNumber(value['width'], PDF_NODE_LIMITS.dimension.min, PDF_NODE_LIMITS.dimension.max, nodeId, 'width', errors);
  const heightValid = validateNumber(value['height'], PDF_NODE_LIMITS.dimension.min, PDF_NODE_LIMITS.dimension.max, nodeId, 'height', errors);
  if (xValid && widthValid && (value['x'] as number) + (value['width'] as number) > PDF_PAGE_WIDTH) {
    addError(errors, nodeId, 'x', `Node ${nodeId} exceeds page width (x + width must be <= ${PDF_PAGE_WIDTH})`);
  }
  if (yValid && heightValid && (value['y'] as number) + (value['height'] as number) > PDF_PAGE_HEIGHT) {
    addError(errors, nodeId, 'y', `Node ${nodeId} exceeds page height (y + height must be <= ${PDF_PAGE_HEIGHT})`);
  }

  switch (value['type']) {
    case 'text': {
      validateTemplate(value['content'], PDF_NODE_LIMITS.text.content.minLength, PDF_NODE_LIMITS.text.content.maxLength, nodeId, 'content', errors);
      const style = validateStyleObject(value['style'], nodeId, 'style', errors);
      if (style) {
        validateNumber(style['fontSize'], PDF_NODE_LIMITS.text.fontSize.min, PDF_NODE_LIMITS.text.fontSize.max, nodeId, 'style.fontSize', errors);
        if (typeof style['bold'] !== 'boolean') addError(errors, nodeId, 'style.bold', 'Must be a boolean');
        if (!['left', 'center', 'right'].includes(String(style['align']))) addError(errors, nodeId, 'style.align', 'Must be left, center, or right');
        validateColor(style['color'], nodeId, 'style.color', errors);
      }
      break;
    }
    case 'image': {
      if (typeof value['attachmentId'] !== 'string' || value['attachmentId'].trim().length < PDF_NODE_LIMITS.image.attachmentIdMinLength) {
        addError(errors, nodeId, 'attachmentId', 'Attachment ID must be a non-empty string');
      }
      break;
    }
    case 'table': {
      const rows = value['rows'];
      if (!Array.isArray(rows) || rows.length < PDF_NODE_LIMITS.table.rowCount.min || rows.length > PDF_NODE_LIMITS.table.rowCount.max) {
        addError(errors, nodeId, 'rows', 'Table must have between 1 and 50 rows');
        break;
      }
      let columnCount: number | null = null;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row: unknown = rows[rowIndex];
        if (!Array.isArray(row) || row.length < PDF_NODE_LIMITS.table.columnCount.min || row.length > PDF_NODE_LIMITS.table.columnCount.max) {
          addError(errors, nodeId, `rows.${rowIndex}`, 'Each table row must have between 1 and 12 columns');
          continue;
        }
        if (columnCount === null) columnCount = row.length;
        else if (row.length !== columnCount) addError(errors, nodeId, 'rows', 'Every row in a table must have the same length');
        row.forEach((cell: unknown, columnIndex: number) => {
          validateTemplate(cell, PDF_NODE_LIMITS.table.cell.minLength, PDF_NODE_LIMITS.table.cell.maxLength, nodeId, `rows.${rowIndex}.${columnIndex}`, errors);
        });
      }
      if (columnCount !== null) {
        const columnAligns = value['columnAligns'];
        if (columnAligns !== undefined) {
          if (!Array.isArray(columnAligns) || columnAligns.length !== columnCount || columnAligns.some((align: unknown) => !['left', 'center', 'right'].includes(String(align)))) {
            addError(errors, nodeId, 'columnAligns', `columnAligns length must match column count (${columnCount}) and use valid alignments`);
          }
        }
        const columnWidths = value['columnWidths'];
        if (columnWidths !== undefined) {
          if (!Array.isArray(columnWidths) || columnWidths.length !== columnCount || columnWidths.some((width: unknown) => typeof width !== 'number' || width <= 0 || !Number.isFinite(width))) {
            addError(errors, nodeId, 'columnWidths', `columnWidths length must match column count (${columnCount}) and be positive`);
          }
        }
      }
      if (value['headerFill'] !== undefined) validateColor(value['headerFill'], nodeId, 'headerFill', errors);
      if (value['zebra'] !== undefined && typeof value['zebra'] !== 'boolean') addError(errors, nodeId, 'zebra', 'Must be a boolean');
      if (value['boldRows'] !== undefined) {
        if (!Array.isArray(value['boldRows']) || value['boldRows'].some((rowIndex: unknown) => !Number.isInteger(rowIndex) || (rowIndex as number) < 0 || (rowIndex as number) >= rows.length)) {
          addError(errors, nodeId, 'boldRows', `boldRows indexes must be between 0 and ${rows.length - 1}`);
        }
      }
      const style = validateStyleObject(value['style'], nodeId, 'style', errors);
      if (style) {
        validateNumber(style['fontSize'], PDF_NODE_LIMITS.table.fontSize.min, PDF_NODE_LIMITS.table.fontSize.max, nodeId, 'style.fontSize', errors);
        if (typeof style['headerBold'] !== 'boolean') addError(errors, nodeId, 'style.headerBold', 'Must be a boolean');
        validateColor(style['borderColor'], nodeId, 'style.borderColor', errors);
      }
      break;
    }
    case 'divider': {
      const style = validateStyleObject(value['style'], nodeId, 'style', errors);
      if (style) {
        validateColor(style['color'], nodeId, 'style.color', errors);
        validateNumber(style['thickness'], PDF_NODE_LIMITS.divider.thickness.min, PDF_NODE_LIMITS.divider.thickness.max, nodeId, 'style.thickness', errors);
      }
      break;
    }
    default:
      addError(errors, nodeId, 'type', `Unsupported node type at index ${index}`);
  }
}

export function validateNodes(nodes: readonly unknown[]): PdfNodeValidationError[] {
  const errors: PdfNodeValidationError[] = [];
  const ids = new Set<string>();
  if (nodes.length > PDF_NODE_LIMITS.nodeCount.max) {
    addError(errors, '', 'nodes', `At most ${PDF_NODE_LIMITS.nodeCount.max} nodes are allowed`);
  }
  nodes.forEach((node, index) => validateNode(node, index, ids, errors));
  return errors;
}
