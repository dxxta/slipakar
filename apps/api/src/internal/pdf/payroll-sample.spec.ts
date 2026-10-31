import fs from 'node:fs';
import zlib from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { pdfNodeTreeSchema } from '../../domain/pdf-templates/dto.js';
import { buildPdfRenderer } from './renderer.js';
import {
  payrollTemplateNodeTree,
  samplePayrollBatch,
  samplePayrollEmployee,
} from './fixtures/payroll-template.js';

function extractAllPdfTexts(buffer: Buffer): string[] {
  const texts: string[] = [];

  // 1. Direct TJ matches if uncompressed
  const latin = buffer.toString('latin1');
  const tjMatches = [...latin.matchAll(/\[(.*?)\]\s*TJ/gs)];
  for (const m of tjMatches) {
    const raw = [...m[1].matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((x) => Buffer.from(x[1], 'hex').toString('latin1'))
      .join('');
    if (raw) texts.push(raw);
  }

  // 2. Also look for compressed FlateDecode streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(latin)) !== null) {
    const streamBytes = Buffer.from(match[1], 'latin1');
    try {
      const decompressed = zlib.inflateSync(streamBytes).toString('latin1');
      const innerTjMatches = [...decompressed.matchAll(/\[(.*?)\]\s*TJ/gs)];
      for (const m of innerTjMatches) {
        const raw = [...m[1].matchAll(/<([0-9a-fA-F]+)>/g)]
          .map((x) => Buffer.from(x[1], 'hex').toString('latin1'))
          .join('');
        if (raw) texts.push(raw);
      }
      // Also check standard Tj text operator in decompressed stream
      const innerTjSingle = [...decompressed.matchAll(/\((.*?)\)\s*Tj/gs)];
      for (const m of innerTjSingle) {
        if (m[1]) texts.push(m[1]);
      }
    } catch {
      // not a flate stream or uncompressed chunk
    }
  }

  return texts;
}

function getPdfPageCount(buffer: Buffer): number {
  const latin = buffer.toString('latin1');
  const pageMatches = latin.match(/\/Type\s*\/Page\b(?!\s*s)/g);
  return pageMatches ? pageMatches.length : 1;
}

describe('Payroll Sample PDF', () => {
  const dummyImageLoader = vi.fn().mockResolvedValue(null);

  it('validates payrollTemplateNodeTree with the real pdf-templates domain validator', () => {
    const parsed = pdfNodeTreeSchema.safeParse(payrollTemplateNodeTree);
    expect(parsed.success).toBe(true);
  });

  it('ensures boldRows in the payroll table accurately match the rows containing Gross Earnings and Total Deductions', () => {
    const tableNode = payrollTemplateNodeTree.nodes.find(
      (n) => n.id === 'payroll-table' && n.type === 'table',
    );
    expect(tableNode).toBeDefined();
    if (!tableNode || tableNode.type !== 'table') return;

    const boldRows = tableNode.boldRows ?? [];
    // Every bold row index must contain either Gross Earnings or Total Deductions
    for (const rowIndex of boldRows) {
      const row = tableNode.rows[rowIndex];
      const hasTargetLabel = row.some(
        (cell) => cell.includes('Gross Earnings') || cell.includes('Total Deductions'),
      );
      expect(hasTargetLabel).toBe(true);
      // It must NOT contain Overtime Pay
      expect(row.some((cell) => cell.includes('Overtime Pay'))).toBe(false);
    }

    // Both Gross Earnings and Total Deductions must be covered in bold rows
    const allBoldRowCells = boldRows.flatMap((idx) => tableNode.rows[idx]);
    expect(allBoldRowCells.some((c) => c.includes('Gross Earnings'))).toBe(true);
    expect(allBoldRowCells.some((c) => c.includes('Total Deductions'))).toBe(true);
  });

  it('renders payroll PDF and satisfies structural and content assertions', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });

    const pdfBuffer = await renderer.renderPdf({
      projectId: 'project-payroll-1',
      tree: payrollTemplateNodeTree,
      row: samplePayrollEmployee,
    });

    // Check %PDF- header and %%EOF footer
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const tail = pdfBuffer.subarray(pdfBuffer.length - 10).toString('ascii');
    expect(tail).toContain('%%EOF');

    // Single page
    const pageCount = getPdfPageCount(pdfBuffer);
    expect(pageCount).toBe(1);

    // Extract text and assert required contents
    const texts = extractAllPdfTexts(pdfBuffer);
    const combinedText = texts.join(' ');

    expect(combinedText).toContain(samplePayrollEmployee.employee_name);
    expect(combinedText).toContain(samplePayrollEmployee.net_pay);
    expect(combinedText).toContain(samplePayrollEmployee.company_name);
    expect(combinedText).toContain(samplePayrollEmployee.basic_salary);
    expect(combinedText).toContain(samplePayrollEmployee.allowance);
    expect(combinedText).toContain(samplePayrollEmployee.overtime);
    expect(combinedText).toContain(samplePayrollEmployee.gross_earnings);
    expect(combinedText).toContain(samplePayrollEmployee.tax_deduction);
    expect(combinedText).toContain(samplePayrollEmployee.insurance_deduction);
    expect(combinedText).toContain(samplePayrollEmployee.total_deductions);

    // Assert no leftover unreplaced placeholders exist in rendered text
    expect(texts.some((t) => t.includes('{{') || t.includes('}}'))).toBe(false);

    // Write to PAYROLL_PDF_OUT if env var is set
    const outPath = process.env.PAYROLL_PDF_OUT;
    if (outPath) {
      fs.writeFileSync(outPath, pdfBuffer);
    }
  });

  it('renders a 3-employee batch and generates 3 distinct PDFs', async () => {
    const renderer = buildPdfRenderer({ imageLoader: dummyImageLoader });
    const renderedPdfs: Buffer[] = [];

    for (const emp of samplePayrollBatch) {
      const pdf = await renderer.renderPdf({
        projectId: 'project-payroll-1',
        tree: payrollTemplateNodeTree,
        row: emp,
      });
      renderedPdfs.push(pdf);
    }

    expect(renderedPdfs).toHaveLength(3);

    // Each PDF buffer should be distinct
    const pdf1 = renderedPdfs[0];
    const pdf2 = renderedPdfs[1];
    const pdf3 = renderedPdfs[2];

    expect(pdf1.equals(pdf2)).toBe(false);
    expect(pdf2.equals(pdf3)).toBe(false);
    expect(pdf1.equals(pdf3)).toBe(false);

    const texts1 = extractAllPdfTexts(pdf1).join(' ');
    const texts2 = extractAllPdfTexts(pdf2).join(' ');
    const texts3 = extractAllPdfTexts(pdf3).join(' ');

    expect(texts1).toContain('Jane Doe');
    expect(texts1).toContain('$7,320.00');

    expect(texts2).toContain('John Smith');
    expect(texts2).toContain('$5,440.00');

    expect(texts3).toContain('Alice Johnson');
    expect(texts3).toContain('$6,640.00');
  });
});
