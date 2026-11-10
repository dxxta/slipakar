import { z } from 'zod';
import { assertSafeTemplate } from '../../internal/templates/renderer/template-renderer.js';

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

const safeString = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .superRefine((val, ctx) => {
      try {
        assertSafeTemplate(val);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Template contains unsafe placeholder syntax',
        });
      }
    });

const baseNodeSchema = z.object({
  id: z.string().trim().min(1).max(64),
  x: z.number().min(0).max(842),
  y: z.number().min(0).max(842),
  width: z.number().min(1).max(842),
  height: z.number().min(1).max(842),
});

const textNodeSchema = baseNodeSchema.extend({
  type: z.literal('text'),
  content: safeString(1, 5000),
  style: z.object({
    fontSize: z.number().min(6).max(72),
    bold: z.boolean(),
    align: z.enum(['left', 'center', 'right']),
    color: z.string().regex(colorRegex, 'Invalid hex color'),
  }),
});

const imageNodeSchema = baseNodeSchema.extend({
  type: z.literal('image'),
  attachmentId: z.string().trim().min(1),
});

const tableNodeSchema = baseNodeSchema.extend({
  type: z.literal('table'),
  rows: z
    .array(z.array(safeString(0, 500)).min(1).max(12))
    .min(1)
    .max(50)
    .superRefine((rows, ctx) => {
      if (rows.length > 0) {
        const expectedCols = rows[0].length;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i].length !== expectedCols) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Every row in a table must have the same length',
            });
            break;
          }
        }
      }
    }),
  columnAligns: z.array(z.enum(['left', 'center', 'right'])).optional(),
  columnWidths: z.array(z.number().positive('Column width weight must be positive')).optional(),
  headerFill: z.string().regex(colorRegex, 'Invalid hex color').optional(),
  zebra: z.boolean().optional(),
  boldRows: z.array(z.number().int().min(0)).optional(),
  style: z.object({
    fontSize: z.number().min(6).max(72),
    headerBold: z.boolean(),
    borderColor: z.string().regex(colorRegex, 'Invalid hex color'),
  }),
}).superRefine((node, ctx) => {
  const colCount = node.rows.length > 0 ? node.rows[0].length : 0;
  if (node.columnAligns !== undefined && node.columnAligns.length !== colCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `columnAligns length (${node.columnAligns.length}) must match column count (${colCount})`,
    });
  }
  if (node.columnWidths !== undefined && node.columnWidths.length !== colCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `columnWidths length (${node.columnWidths.length}) must match column count (${colCount})`,
    });
  }
  if (node.boldRows !== undefined) {
    const rowCount = node.rows.length;
    for (const rowIndex of node.boldRows) {
      if (rowIndex < 0 || rowIndex >= rowCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `boldRows index ${rowIndex} is out of bounds (must be between 0 and ${rowCount - 1})`,
        });
      }
    }
  }
});

const dividerNodeSchema = baseNodeSchema.extend({
  type: z.literal('divider'),
  style: z.object({
    color: z.string().regex(colorRegex, 'Invalid hex color'),
    thickness: z.number().min(0.5).max(10),
  }),
});

const sheetNodeSchema = baseNodeSchema.extend({
  type: z.literal('sheet'),
  style: z.object({
    color: z.string().regex(colorRegex, 'Invalid hex color'),
  }),
});

export const pdfNodeSchema = z
  .discriminatedUnion('type', [
    textNodeSchema,
    imageNodeSchema,
    tableNodeSchema,
    dividerNodeSchema,
    sheetNodeSchema,
  ])
  .superRefine((node, ctx) => {
    // Node must stay inside page (A4: 595 width x 842 height)
    if (node.x + node.width > 595) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node ${node.id} exceeds page width (x + width must be <= 595)`,
      });
    }
    if (node.y + node.height > 842) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node ${node.id} exceeds page height (y + height must be <= 842)`,
      });
    }
  });

export const pdfNodeTreeSchema = z
  .object({
    page: z.object({
      size: z.literal('A4'),
      margin: z.number().min(0).max(100),
    }),
    nodes: z.array(pdfNodeSchema).max(200),
  })
  .superRefine((tree, ctx) => {
    const ids = new Set<string>();
    for (const node of tree.nodes) {
      if (ids.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node ID: ${node.id}`,
        });
      }
      ids.add(node.id);
    }
  });

export const listPdfTemplatesSortByEnum = z.enum(['name', 'createdAt', 'updatedAt']);
export type ListPdfTemplatesSortBy = z.infer<typeof listPdfTemplatesSortByEnum>;

export const listPdfTemplatesQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listPdfTemplatesSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListPdfTemplatesQuery = z.infer<typeof listPdfTemplatesQueryDto>;

export const createPdfTemplatesDto = z.strictObject({
  name: z.string().trim().min(1).max(100),
  nodeTree: pdfNodeTreeSchema,
});

export const updatePdfTemplatesDto = createPdfTemplatesDto
  .partial()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'Update payload must have at least one field',
  });

export type CreatePdfTemplatesInput = z.infer<typeof createPdfTemplatesDto>;
export type UpdatePdfTemplatesInput = z.infer<typeof updatePdfTemplatesDto>;
