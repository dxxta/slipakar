import { describe, expect, it } from 'vitest';
import { PdfEditorState } from './editor-state';

describe('PdfEditorState', () => {
  it('adds a sheet behind the other elements with a changeable color', () => {
    const state = new PdfEditorState();
    state.addNode('text');
    const sheet = state.addNode('sheet');
    expect(sheet.type === 'sheet' && sheet.style.color).toBe('#E5E7EB');
    expect(state.nodes()[0]?.id).toBe(sheet.id);
    state.updateNode(sheet.id, { style: { color: '#FF0000' } } as never);
    const updated = state.nodes()[0];
    expect(updated?.type === 'sheet' && updated.style.color).toBe('#FF0000');
  });

  it('adds each supported node type with usable defaults', () => {
    const state = new PdfEditorState();

    const text = state.addNode('text');
    const table = state.addNode('table');
    const image = state.addNode('image');
    const divider = state.addNode('divider');

    expect(text.type).toBe('text');
    expect(table.type).toBe('table');
    expect(table.type === 'table' && table.rows).toHaveLength(3);
    expect(table.type === 'table' && table.rows[0]).toHaveLength(3);
    expect(image.type).toBe('image');
    expect(divider.type).toBe('divider');
    expect(state.nodes()).toHaveLength(4);
    expect(state.dirty()).toBe(true);
  });

  it('clamps moves inside the page and snaps coordinates to the 8 point grid', () => {
    const state = new PdfEditorState();
    const node = state.addNode('text');
    state.moveNode(node.id, 1000, 1000);
    const moved = state.nodes()[0];
    expect(moved.x + moved.width).toBeLessThanOrEqual(595);
    expect(moved.y + moved.height).toBeLessThanOrEqual(842);
    expect(moved.x % 8).toBe(0);
    expect(moved.y % 8).toBe(0);

    state.setSnapToGrid(false);
    state.moveNode(node.id, -1000, -1000);
    expect(state.nodes()[0].x).toBe(0);
    expect(state.nodes()[0].y).toBe(0);
  });

  it('enforces the minimum size when resizing from each edge', () => {
    const state = new PdfEditorState();
    const node = state.addNode('text');
    state.resizeNode(node.id, 'nw', 1000, 1000);
    const resized = state.nodes()[0];
    expect(resized.width).toBeGreaterThanOrEqual(8);
    expect(resized.height).toBeGreaterThanOrEqual(8);
    expect(resized.x).toBeGreaterThanOrEqual(0);
    expect(resized.y).toBeGreaterThanOrEqual(0);
    expect(resized.x + resized.width).toBeLessThanOrEqual(595);
    expect(resized.y + resized.height).toBeLessThanOrEqual(842);
  });

  it('coalesces a continuous drag into one undo step', () => {
    const state = new PdfEditorState();
    const node = state.addNode('text');
    state.load(state.nodes());
    const start = state.nodes()[0];
    state.beginTransaction();
    state.moveNode(node.id, 8, 8);
    state.moveNode(node.id, 8, 8);
    state.moveNode(node.id, 8, 8);
    state.commitTransaction();

    expect(state.nodes()[0].x).toBe(start.x + 24);
    expect(state.undo()).toBe(true);
    expect(state.nodes()[0].x).toBe(start.x);
    expect(state.undo()).toBe(false);
  });

  it('duplicates with a new id and offset, and changes z-order', () => {
    const state = new PdfEditorState();
    const first = state.addNode('text');
    const second = state.addNode('divider');
    const duplicate = state.duplicateNode(first.id);

    expect(duplicate?.id).not.toBe(first.id);
    expect(duplicate?.x).toBe(first.x + 8);
    expect(state.nodes().map((node) => node.id)).toEqual([first.id, second.id, duplicate?.id]);
    state.sendBackward(duplicate?.id ?? '');
    expect(state.nodes().map((node) => node.id)).toEqual([first.id, duplicate?.id, second.id]);
    state.bringForward(duplicate?.id ?? '');
    expect(state.nodes().map((node) => node.id)).toEqual([first.id, second.id, duplicate?.id]);
  });

  it('serializes the API node tree and resets dirty state when loaded', () => {
    const state = new PdfEditorState();
    const node = state.addNode('text');
    const payload = state.toJSON();
    expect(payload).toEqual({ page: { size: 'A4', margin: 0 }, nodes: [node] });
    state.load(payload.nodes);
    expect(state.dirty()).toBe(false);
    expect(state.undo()).toBe(false);
  });
});
