import PDFDocument from 'pdfkit';
import type { PdfRendererInterface } from '../../domain/pdf/interface.js';
import { AppError } from '../../lib/app-error.js';
import { fillPlaceholders } from '../templates/renderer/template-renderer.js';

export function buildPdfRenderer({
  imageLoader,
}: {
  imageLoader: (projectId: string, attachmentId: string) => Promise<Buffer | null>;
}): PdfRendererInterface {
  return {
    async renderPdf({ projectId, tree, row }): Promise<Buffer> {
      // First pass: validate all placeholders in the tree before generating PDF
      for (const node of tree.nodes) {
        if (node.type === 'text') {
          fillPlaceholders(node.content, row);
        } else if (node.type === 'table') {
          for (const tableRow of node.rows) {
            for (const cell of tableRow) {
              fillPlaceholders(cell, row);
            }
          }
        }
      }

      return new Promise<Buffer>((resolve, reject) => {
        try {
          const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
            compress: false,
          });

          const chunks: Buffer[] = [];
          doc.on('data', (chunk: Buffer) => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', (err: Error) => reject(err));

          (async () => {
            for (const node of tree.nodes) {
              if (node.type === 'text') {
                const filled = fillPlaceholders(node.content, row);
                doc.font(node.style.bold ? 'Helvetica-Bold' : 'Helvetica')
                  .fontSize(node.style.fontSize)
                  .fillColor(node.style.color)
                  .text(filled, node.x, node.y, {
                    width: node.width,
                    height: node.height,
                    align: node.style.align,
                    lineBreak: true,
                  });
              } else if (node.type === 'sheet') {
                doc.save()
                  .fillColor(node.style.color)
                  .rect(node.x, node.y, node.width, node.height)
                  .fill()
                  .restore();
              } else if (node.type === 'divider') {
                doc.save()
                  .lineWidth(node.style.thickness)
                  .strokeColor(node.style.color)
                  .moveTo(node.x, node.y)
                  .lineTo(node.x + node.width, node.y)
                  .stroke()
                  .restore();
              } else if (node.type === 'table') {
                const rowCount = node.rows.length;
                if (rowCount === 0) continue;
                const colCount = node.rows[0].length;
                if (colCount === 0) continue;

                // Calculate column widths
                let colWidths: number[];
                if (node.columnWidths && node.columnWidths.length === colCount) {
                  const totalWeight = node.columnWidths.reduce((sum, w) => sum + w, 0);
                  colWidths = node.columnWidths.map((w) => (w / totalWeight) * node.width);
                } else {
                  const equalWidth = node.width / colCount;
                  colWidths = Array(colCount).fill(equalWidth);
                }

                // Precompute cumulative X offsets for columns
                const colXOffsets: number[] = [0];
                for (let c = 0; c < colCount; c++) {
                  colXOffsets.push(colXOffsets[c] + colWidths[c]);
                }

                const rowHeight = node.height / rowCount;
                const boldRowsSet = new Set(node.boldRows ?? []);

                // Draw table backgrounds, borders & cells
                doc.save();
                for (let r = 0; r < rowCount; r++) {
                  const isHeader = r === 0;
                  const isBold = (isHeader && node.style.headerBold) || boldRowsSet.has(r);
                  doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(node.style.fontSize);

                  // Determine background fill color
                  let rowFill: string | null = null;
                  if (isHeader && node.headerFill) {
                    rowFill = node.headerFill;
                  } else if (!isHeader && node.zebra && r % 2 === 1) {
                    rowFill = '#F8FAFC';
                  }

                  for (let c = 0; c < colCount; c++) {
                    const cellX = node.x + colXOffsets[c];
                    const cellY = node.y + r * rowHeight;
                    const currentColWidth = colWidths[c];
                    const cellText = fillPlaceholders(node.rows[r][c] ?? '', row);
                    const cellAlign = node.columnAligns?.[c] ?? 'left';

                    // Background fill if applicable
                    if (rowFill) {
                      doc.rect(cellX, cellY, currentColWidth, rowHeight).fill(rowFill);
                    }

                    // Cell border
                    doc.lineWidth(1)
                      .strokeColor(node.style.borderColor)
                      .rect(cellX, cellY, currentColWidth, rowHeight)
                      .stroke();

                    // Cell text
                    doc.fillColor('#000000').text(cellText, cellX + 2, cellY + 2, {
                      width: currentColWidth - 4,
                      height: rowHeight - 4,
                      align: cellAlign,
                      ellipsis: true,
                    });
                  }
                }
                doc.restore();
              } else if (node.type === 'image') {
                const imageBytes = await imageLoader(projectId, node.attachmentId);
                if (!imageBytes) {
                  throw new AppError(422, 'IMAGE_NOT_FOUND', 'Image attachment not found');
                }
                doc.image(imageBytes, node.x, node.y, {
                  fit: [node.width, node.height],
                });
              }
            }
            doc.end();
          })().catch(reject);
        } catch (error) {
          reject(error);
        }
      });
    },
  };
}
