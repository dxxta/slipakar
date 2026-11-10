import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PdfBuilderEditor } from './pdf-builder-editor';
import { validateNodes, type PdfNode } from './pdf-node.types';
import type { PdfNodeTree } from './pdf-node.types';

describe('PdfBuilderEditor', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [PdfBuilderEditor] }));

  it('adds a text node to the canvas', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="add-text-node"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-node-type="text"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Text');
  });

  it('shows the uploaded picture on image nodes and falls back to a placeholder when it fails', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    fixture.componentRef.setInput('attachmentBase', '/projects/p-1/attachments');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="add-image-node"]').click();
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img.image-preview') as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toBe('/projects/p-1/attachments/attachment-id/content');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img.image-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('.image-placeholder')).not.toBeNull();
  });

  it('selects a canvas node when clicked', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="add-text-node"]').click();
    fixture.detectChanges();
    const node = fixture.nativeElement.querySelector('[data-node-type="text"]') as HTMLElement;

    node.click();
    fixture.detectChanges();

    expect(node.classList.contains('is-selected')).toBe(true);
    expect(fixture.componentInstance.editor.selectedId()).not.toBeNull();
  });

  it('nudges with arrow keys, deletes, and restores with undo', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="add-text-node"]').click();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const node = component.editor.nodes()[0];
    const startX = node.x;

    fixture.nativeElement.querySelector('[data-testid="pdf-builder-application"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(component.editor.nodes()[0].x).toBe(startX + 1);

    fixture.nativeElement.querySelector('[data-testid="pdf-builder-application"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
    );
    expect(component.editor.nodes()).toHaveLength(0);
    fixture.nativeElement.querySelector('[data-testid="pdf-builder-application"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.editor.nodes()).toHaveLength(1);
  });

  it('keeps keyboard move history when the parent echoes the emitted node tree', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    fixture.componentRef.setInput('nodes', [{
      id: 'keyboard-node', type: 'text', x: 40, y: 40, width: 120, height: 30, content: 'Keyboard',
      style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
    }]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const application = fixture.nativeElement.querySelector('[data-testid="pdf-builder-application"]') as HTMLElement;
    component.editor.selectedId.set('keyboard-node');
    application.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    expect(component.editor.nodes()[0].y).toBe(48);

    fixture.componentRef.setInput('nodes', component.editor.nodes());
    fixture.detectChanges();
    application.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));

    expect(component.editor.nodes()[0].y).toBe(40);
    application.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    expect(component.editor.nodes()[0].y).toBe(48);
  });

  it('emits the API node tree and valid state after committed edits', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    const changes: PdfNodeTree[] = [];
    const validity: boolean[] = [];
    fixture.componentInstance.nodesChange.subscribe((value) => changes.push(value));
    fixture.componentInstance.valid.subscribe((value) => validity.push(value));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="add-text-node"]').click();
    fixture.detectChanges();

    expect(changes).toHaveLength(1);
    expect(changes[0].page).toEqual({ size: 'A4', margin: 0 });
    expect(validateNodes(changes[0].nodes)).toEqual([]);
    expect(validity.at(-1)).toBe(true);
  });

  it('reports invalid initial nodes through valid output', () => {
    const fixture = TestBed.createComponent(PdfBuilderEditor);
    const validity: boolean[] = [];
    fixture.componentInstance.valid.subscribe((value) => validity.push(value));
    fixture.componentRef.setInput('nodes', [{
      id: 'bad', type: 'text', x: 600, y: 0, width: 10, height: 10, content: 'outside page',
      style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
    } as PdfNode]);
    fixture.detectChanges();

    expect(fixture.componentInstance.validState()).toBe(false);
    expect(validity).toContain(false);
  });
});
