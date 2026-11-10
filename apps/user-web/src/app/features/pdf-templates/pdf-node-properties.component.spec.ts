import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PdfNodePropertiesComponent } from './pdf-node-properties.component';
import type {
  PdfDividerNode,
  PdfImageNode,
  PdfNode,
  PdfTableNode,
  PdfTextNode,
} from '../pdf-builder/pdf-node.types';

describe('PdfNodePropertiesComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PdfNodePropertiesComponent],
    });
  });

  it('renders empty message when no node is selected', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    fixture.componentInstance.node = null;
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('[data-testid="no-node-selected"]');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No node selected');
  });

  it('emits geometry patch on x, y, width, height inputs', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfTextNode = {
      id: 'txt-1',
      type: 'text',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      content: 'Hello',
      style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
    };
    fixture.componentInstance.node = node;
    fixture.detectChanges();

    let emittedPatch: Partial<PdfNode> | undefined;
    fixture.componentInstance.patch.subscribe((p) => (emittedPatch = p));

    const xInput = fixture.nativeElement.querySelector('[data-testid="geom-x"]');
    xInput.value = '45';
    xInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emittedPatch).toEqual({ x: 45 });
  });

  it('renders and patches text node properties (content, font size, bold, align, color)', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfTextNode = {
      id: 'txt-1',
      type: 'text',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      content: 'Hello World',
      style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
    };
    fixture.componentInstance.node = node;
    fixture.componentInstance.placeholders = ['first_name', 'company'];
    fixture.detectChanges();

    let emittedPatch: Partial<PdfNode> | undefined;
    fixture.componentInstance.patch.subscribe((p) => (emittedPatch = p));

    // Content change
    const textarea = fixture.nativeElement.querySelector('[data-testid="text-content"]');
    textarea.value = 'New text';
    textarea.dispatchEvent(new Event('input'));
    expect(emittedPatch).toEqual({ content: 'New text' });

    // Font size change
    const fontSizeInput = fixture.nativeElement.querySelector('[data-testid="text-font-size"]');
    fontSizeInput.value = '18';
    fontSizeInput.dispatchEvent(new Event('input'));
    expect(emittedPatch).toEqual({
      style: { fontSize: 18, bold: false, align: 'left', color: '#000000' },
    });

    // Alignment change
    const alignSelect = fixture.nativeElement.querySelector('[data-testid="text-align"]');
    alignSelect.value = 'center';
    alignSelect.dispatchEvent(new Event('change'));
    expect(emittedPatch).toEqual({
      style: { fontSize: 12, bold: false, align: 'center', color: '#000000' },
    });

    // Bold checkbox
    const boldInput = fixture.nativeElement.querySelector('[data-testid="text-bold"]');
    boldInput.checked = true;
    boldInput.dispatchEvent(new Event('change'));
    expect(emittedPatch).toEqual({
      style: { fontSize: 12, bold: true, align: 'left', color: '#000000' },
    });

    // Placeholder chip click inserts {{placeholder}}
    const chip = fixture.nativeElement.querySelector('[data-testid="insert-placeholder-first_name"]');
    expect(chip).not.toBeNull();
    chip.click();
    expect(emittedPatch).toEqual({ content: 'Hello World {{first_name}}' });
  });

  it('renders and patches table node, and adding column keeps all rows equal length', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfTableNode = {
      id: 'tbl-1',
      type: 'table',
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      rows: [
        ['Header 1', 'Header 2'],
        ['Cell 1', 'Cell 2'],
      ],
      style: { fontSize: 10, headerBold: true, borderColor: '#cccccc' },
    };
    fixture.componentInstance.node = node;
    fixture.detectChanges();

    let emittedPatch: Partial<PdfNode> | undefined;
    fixture.componentInstance.patch.subscribe((p) => (emittedPatch = p));

    // Add Column
    const addColBtn = fixture.nativeElement.querySelector('[data-testid="table-add-column"]');
    addColBtn.click();

    expect(emittedPatch).toBeDefined();
    const updatedRows = (emittedPatch as { rows: string[][] }).rows;
    expect(updatedRows).toBeDefined();
    expect(updatedRows.length).toBe(2);
    // Every row must have 3 columns now
    expect(updatedRows[0].length).toBe(3);
    expect(updatedRows[1].length).toBe(3);
    expect(updatedRows[0][2]).toBe('');
    expect(updatedRows[1][2]).toBe('');

    // Add Row
    const addRowBtn = fixture.nativeElement.querySelector('[data-testid="table-add-row"]');
    addRowBtn.click();
    const rowsAfterRowAdd = (emittedPatch as { rows: string[][] }).rows;
    expect(rowsAfterRowAdd.length).toBe(3);
    expect(rowsAfterRowAdd[2].length).toBe(2); // node.rows still has 2 cols in input
  });

  it('emits the chosen file when uploading an image for an image node', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfImageNode = { id: 'img-up', type: 'image', x: 0, y: 0, width: 100, height: 50, attachmentId: '' };
    fixture.componentInstance.node = node as PdfNode;
    const emitted: File[] = [];
    fixture.componentInstance.imageUpload.subscribe((file) => emitted.push(file));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('[data-testid="image-upload-input"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([file]);
  });

  it('renders and patches image node attachment selection', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfImageNode = {
      id: 'img-1',
      type: 'image',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      attachmentId: 'att-1',
    };
    fixture.componentInstance.node = node;
    fixture.componentInstance.attachments = [
      { id: 'att-1', projectId: 'p1', fileName: 'logo.png', sizeBytes: '1024', kind: 'image/png', createdAt: '' },
      { id: 'att-2', projectId: 'p1', fileName: 'banner.png', sizeBytes: '2048', kind: 'image/png', createdAt: '' },
    ];
    fixture.detectChanges();

    let emittedPatch: Partial<PdfNode> | undefined;
    fixture.componentInstance.patch.subscribe((p) => (emittedPatch = p));

    const select = fixture.nativeElement.querySelector('[data-testid="image-attachment-select"]');
    select.value = 'att-2';
    select.dispatchEvent(new Event('change'));

    expect(emittedPatch).toEqual({ attachmentId: 'att-2' });
  });

  it('renders and patches divider node thickness and color', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfDividerNode = {
      id: 'div-1',
      type: 'divider',
      x: 10,
      y: 50,
      width: 300,
      height: 2,
      style: { thickness: 1, color: '#000000' },
    };
    fixture.componentInstance.node = node;
    fixture.detectChanges();

    let emittedPatch: Partial<PdfNode> | undefined;
    fixture.componentInstance.patch.subscribe((p) => (emittedPatch = p));

    const thicknessInput = fixture.nativeElement.querySelector('[data-testid="divider-thickness"]');
    thicknessInput.value = '3';
    thicknessInput.dispatchEvent(new Event('input'));

    expect(emittedPatch).toEqual({ style: { thickness: 3, color: '#000000' } });
  });

  it('emits delete and duplicate events with node id', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfTextNode = {
      id: 'txt-1',
      type: 'text',
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      content: 'T',
      style: { fontSize: 10, bold: false, align: 'left', color: '#000000' },
    };
    fixture.componentInstance.node = node;
    fixture.detectChanges();

    let deletedId: string | undefined;
    let duplicatedId: string | undefined;
    fixture.componentInstance.delete.subscribe((id) => (deletedId = id));
    fixture.componentInstance.duplicate.subscribe((id) => (duplicatedId = id));

    const deleteBtn = fixture.nativeElement.querySelector('[data-testid="delete-node-button"]');
    deleteBtn.click();
    expect(deletedId).toBe('txt-1');

    const dupBtn = fixture.nativeElement.querySelector('[data-testid="duplicate-node-button"]');
    dupBtn.click();
    expect(duplicatedId).toBe('txt-1');
  });

  it('displays inline validation errors matching node id', () => {
    const fixture = TestBed.createComponent(PdfNodePropertiesComponent);
    const node: PdfTextNode = {
      id: 'txt-1',
      type: 'text',
      x: 0,
      y: 0,
      width: 50,
      height: 20,
      content: 'T',
      style: { fontSize: 10, bold: false, align: 'left', color: '#000000' },
    };
    fixture.componentInstance.node = node;
    fixture.componentInstance.errors = [
      { nodeId: 'txt-1', field: 'content', message: 'Content is too short' },
      { nodeId: 'other-node', field: 'width', message: 'Out of bounds' },
    ];
    fixture.detectChanges();

    const errorBlock = fixture.nativeElement.querySelector('[data-testid="node-validation-errors"]');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock.textContent).toContain('content: Content is too short');
    expect(errorBlock.textContent).not.toContain('other-node');
  });
});
