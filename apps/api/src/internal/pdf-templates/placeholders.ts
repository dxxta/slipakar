import type { PdfNodeTree } from '../../domain/pdf-templates/interface.js';
import { extractPlaceholders } from '../templates/renderer/template-renderer.js';

export function extractPdfPlaceholders(tree: PdfNodeTree): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const collect = (text: string) => {
    const placeholders = extractPlaceholders(text);
    for (const ph of placeholders) {
      if (!seen.has(ph)) {
        seen.add(ph);
        result.push(ph);
      }
    }
  };

  for (const node of tree.nodes) {
    if (node.type === 'text') {
      collect(node.content);
    } else if (node.type === 'table') {
      for (const row of node.rows) {
        for (const cell of row) {
          collect(cell);
        }
      }
    }
  }

  return result;
}
