import type { PdfNodeTree } from '../pdf-templates/interface.js';

export interface PdfRendererInterface {
  renderPdf(input: {
    projectId: string;
    tree: PdfNodeTree;
    row: Record<string, string>;
  }): Promise<Buffer>;
}
