import { computed, signal } from '@angular/core';
import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH, type PdfNode, type PdfNodeTree, type PdfNodeType } from './pdf-node.types';

export const PDF_MIN_NODE_SIZE = 8;
export const PDF_SNAP_SIZE = 8;
export const PDF_HISTORY_LIMIT = 100;

export type PdfResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
function cloneNode(node: PdfNode): PdfNode {
  switch (node.type) {
    case 'text':
      return { ...node, style: { ...node.style } };
    case 'divider':
      return { ...node, style: { ...node.style } };
    case 'sheet':
      return { ...node, style: { ...node.style } };
    case 'image':
      return { ...node };
    case 'table':
      return {
        ...node,
        rows: node.rows.map((row) => [...row]),
        columnAligns: node.columnAligns ? [...node.columnAligns] : undefined,
        columnWidths: node.columnWidths ? [...node.columnWidths] : undefined,
        boldRows: node.boldRows ? [...node.boldRows] : undefined,
        style: { ...node.style },
      };
  }
}

function cloneNodes(nodes: readonly PdfNode[]): PdfNode[] {
  return nodes.map(cloneNode);
}

function snap(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / PDF_SNAP_SIZE) * PDF_SNAP_SIZE : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function createDefaultNode(type: PdfNodeType, id: string): PdfNode {
  switch (type) {
    case 'text':
      return {
        id, type, x: 32, y: 32, width: 240, height: 64, content: 'Text',
        style: { fontSize: 12, bold: false, align: 'left', color: '#111827' },
      };
    case 'table':
      return {
        id, type, x: 32, y: 120, width: 420, height: 120,
        rows: [['Name', 'Period', 'Amount'], ['{{name}}', '{{period}}', '{{amount}}'], ['', '', '']],
        columnAligns: ['left', 'left', 'right'], columnWidths: [1, 1, 1], headerFill: '#E5E7EB',
        zebra: true, boldRows: [0], style: { fontSize: 10, headerBold: true, borderColor: '#9CA3AF' },
      };
    case 'image':
      return { id, type, x: 32, y: 270, width: 160, height: 120, attachmentId: 'attachment-id' };
    case 'sheet':
      return { id, type, x: 32, y: 32, width: 200, height: 120, style: { color: '#E5E7EB' } };
    case 'divider':
      return { id, type, x: 32, y: 410, width: 420, height: 1, style: { color: '#9CA3AF', thickness: 1 } };
  }
}

export class PdfEditorState {
  readonly nodes = signal<PdfNode[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly snapToGrid = signal(true);
  readonly dirty = signal(false);
  readonly canUndo = computed(() => this.past.length > 0);
  readonly canRedo = computed(() => this.future.length > 0);

  private readonly past: PdfNode[][] = [];
  private readonly future: PdfNode[][] = [];
  private transactionStart: PdfNode[] | null = null;
  private baseline = '[]';
  private idCounter = 0;

  private nextId(): string {
    const existing = new Set(this.nodes().map((node) => node.id));
    let candidate = '';
    do {
      this.idCounter += 1;
      candidate = `pdf-node-${Date.now().toString(36)}-${this.idCounter.toString(36)}`;
    } while (existing.has(candidate));
    return candidate;
  }

  private setNodes(nextNodes: readonly PdfNode[], recordHistory = true): void {
    const previous = cloneNodes(this.nodes());
    const next = cloneNodes(nextNodes);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    this.nodes.set(next);
    if (recordHistory && this.transactionStart === null) this.record(previous);
    this.refreshDirty();
  }

  private record(previous: PdfNode[]): void {
    this.past.push(previous);
    if (this.past.length > PDF_HISTORY_LIMIT) this.past.shift();
    this.future.length = 0;
  }

  private refreshDirty(): void {
    this.dirty.set(JSON.stringify(this.nodes()) !== this.baseline);
  }

  private updateNodeValue(id: string, transform: (node: PdfNode) => PdfNode): void {
    const current = this.nodes();
    const index = current.findIndex((node) => node.id === id);
    if (index < 0) return;
    const next = cloneNodes(current);
    next[index] = transform(next[index]);
    this.setNodes(next);
  }

  addNode(type: PdfNodeType): PdfNode {
    const node = createDefaultNode(type, this.nextId());
    this.setNodes(type === 'sheet' ? [node, ...this.nodes()] : [...this.nodes(), node]);
    this.selectedId.set(node.id);
    return cloneNode(node);
  }

  updateNode(id: string, changes: Partial<PdfNode>): void {
    this.updateNodeValue(id, (node) => ({ ...node, ...changes } as PdfNode));
  }

  deleteNode(id: string): void {
    const next = this.nodes().filter((node) => node.id !== id);
    if (next.length === this.nodes().length) return;
    this.setNodes(next);
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  duplicateNode(id: string): PdfNode | null {
    const source = this.nodes().find((node) => node.id === id);
    if (!source) return null;
    const duplicate = cloneNode(source);
    duplicate.id = this.nextId();
    duplicate.x = this.clampPosition(snap(source.x + PDF_SNAP_SIZE, this.snapToGrid()), source.width, PDF_PAGE_WIDTH);
    duplicate.y = this.clampPosition(snap(source.y + PDF_SNAP_SIZE, this.snapToGrid()), source.height, PDF_PAGE_HEIGHT);
    this.setNodes([...this.nodes(), duplicate]);
    this.selectedId.set(duplicate.id);
    return cloneNode(duplicate);
  }

  bringForward(id: string): void {
    const nodes = cloneNodes(this.nodes());
    const index = nodes.findIndex((node) => node.id === id);
    if (index < 0 || index >= nodes.length - 1) return;
    [nodes[index], nodes[index + 1]] = [nodes[index + 1], nodes[index]];
    this.setNodes(nodes);
  }

  sendBackward(id: string): void {
    const nodes = cloneNodes(this.nodes());
    const index = nodes.findIndex((node) => node.id === id);
    if (index <= 0) return;
    [nodes[index - 1], nodes[index]] = [nodes[index], nodes[index - 1]];
    this.setNodes(nodes);
  }

  moveNode(id: string, deltaX: number, deltaY: number, snapEnabled = this.snapToGrid()): void {
    this.updateNodeValue(id, (node) => ({
      ...node,
      x: this.clampPosition(snap(node.x + deltaX, snapEnabled), node.width, PDF_PAGE_WIDTH, snapEnabled),
      y: this.clampPosition(snap(node.y + deltaY, snapEnabled), node.height, PDF_PAGE_HEIGHT, snapEnabled),
    } as PdfNode));
  }

  resizeNode(id: string, handle: PdfResizeHandle, deltaX: number, deltaY: number, snapEnabled = this.snapToGrid()): void {
    this.updateNodeValue(id, (node) => {
      const minSize = PDF_MIN_NODE_SIZE;
      const originalRight = node.x + node.width;
      const originalBottom = node.y + node.height;
      let left = node.x;
      let top = node.y;
      let right = originalRight;
      let bottom = originalBottom;

      if (handle.includes('w')) left = clamp(snap(node.x + deltaX, snapEnabled), 0, originalRight - minSize);
      if (handle.includes('e')) right = clamp(snap(originalRight + deltaX, snapEnabled), node.x + minSize, PDF_PAGE_WIDTH);
      if (handle.includes('n')) top = clamp(snap(node.y + deltaY, snapEnabled), 0, originalBottom - minSize);
      if (handle.includes('s')) bottom = clamp(snap(originalBottom + deltaY, snapEnabled), node.y + minSize, PDF_PAGE_HEIGHT);

      if (right - left < minSize) left = right - minSize;
      if (bottom - top < minSize) top = bottom - minSize;
      left = clamp(left, 0, PDF_PAGE_WIDTH - minSize);
      top = clamp(top, 0, PDF_PAGE_HEIGHT - minSize);
      right = clamp(right, left + minSize, PDF_PAGE_WIDTH);
      bottom = clamp(bottom, top + minSize, PDF_PAGE_HEIGHT);
      return { ...node, x: left, y: top, width: right - left, height: bottom - top } as PdfNode;
    });
  }

  private clampPosition(value: number, size: number, pageSize: number, snapEnabled = this.snapToGrid()): number {
    const maximum = pageSize - size;
    if (!snapEnabled) return clamp(value, 0, maximum);
    const snappedMaximum = Math.floor(maximum / PDF_SNAP_SIZE) * PDF_SNAP_SIZE;
    return clamp(snap(value, true), 0, snappedMaximum);
  }

  setSnapToGrid(enabled: boolean): void {
    this.snapToGrid.set(enabled);
  }

  beginTransaction(): void {
    if (this.transactionStart === null) this.transactionStart = cloneNodes(this.nodes());
  }

  commitTransaction(): void {
    if (this.transactionStart === null) return;
    const start = this.transactionStart;
    this.transactionStart = null;
    if (JSON.stringify(start) !== JSON.stringify(this.nodes())) this.record(start);
  }

  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(cloneNodes(this.nodes()));
    this.nodes.set(cloneNodes(previous));
    if (this.selectedId() && !previous.some((node) => node.id === this.selectedId())) this.selectedId.set(null);
    this.refreshDirty();
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(cloneNodes(this.nodes()));
    this.nodes.set(cloneNodes(next));
    this.refreshDirty();
    return true;
  }

  load(nodes: readonly PdfNode[]): void {
    this.nodes.set(cloneNodes(nodes));
    this.selectedId.set(null);
    this.past.length = 0;
    this.future.length = 0;
    this.transactionStart = null;
    this.baseline = JSON.stringify(this.nodes());
    this.dirty.set(false);
  }

  toJSON(): PdfNodeTree {
    return { page: { size: 'A4', margin: 0 }, nodes: cloneNodes(this.nodes()) };
  }
}
