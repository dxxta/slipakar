import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PdfEditorState, type PdfResizeHandle } from './editor-state';
import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH, validateNodes, type PdfNode, type PdfNodeTree, type PdfNodeType } from './pdf-node.types';

type PlaceholderPart = { text: string; placeholder: boolean };
type PointerSession = {
  id: string;
  mode: 'move' | 'resize';
  handle?: PdfResizeHandle;
  lastX: number;
  lastY: number;
  initialJSON: string;
};

const RESIZE_HANDLES: PdfResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

@Component({
  selector: 'app-pdf-builder-editor',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="pdf-builder-application"
      class="grid min-h-[680px] gap-4 rounded-lg border border-border bg-background p-4 lg:grid-cols-[minmax(360px,1fr)_minmax(260px,320px)]"
      role="application"
      aria-label="PDF template editor"
      tabindex="0"
      (keydown)="onKeydown($event)"
    >
      <aside class="flex flex-wrap items-start gap-x-8 gap-y-4 lg:col-span-2" aria-label="PDF elements">
        <div>
          <h2 class="text-sm font-semibold">Add element</h2>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (type of nodeTypes; track type) {
              <button
                type="button"
                class="h-control-9 min-w-24 rounded-ui-md border border-border px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [attr.data-testid]="'add-' + type + '-node'"
                [attr.aria-label]="'Add ' + type + ' element'"
                (click)="addNode(type)"
              >
                <span class="capitalize">{{ type }}</span>
              </button>
            }
          </div>
        </div>

        @if (placeholders().length) {
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fields</h3>
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (placeholder of placeholders(); track placeholder) {
                <button
                  type="button"
                  class="rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [attr.aria-label]="'Insert ' + placeholder + ' placeholder'"
                  (click)="insertPlaceholder(placeholder)"
                >
                  {{ placeholder }}
                </button>
              }
            </div>
          </div>
        }
      </aside>

      <section #canvasRegion class="min-w-0 overflow-auto rounded-md bg-muted/40 p-3" aria-label="PDF page canvas">
        <div class="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button type="button" class="rounded border border-border px-2 py-1 text-xs disabled:opacity-40" aria-label="Undo" [disabled]="!editor.canUndo()" (click)="undo()">Undo</button>
          <button type="button" class="rounded border border-border px-2 py-1 text-xs disabled:opacity-40" aria-label="Redo" [disabled]="!editor.canRedo()" (click)="redo()">Redo</button>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 text-xs"
            aria-label="Toggle snap to 8 point grid"
            [attr.aria-pressed]="editor.snapToGrid()"
            (click)="toggleSnap()"
          >
            Snap {{ editor.snapToGrid() ? 'on' : 'off' }}
          </button>
          <span class="text-xs text-muted-foreground">595 × 842 pt</span>
        </div>
        <div class="mx-auto relative" [style.width.px]="viewportWidth()" [style.height.px]="viewportHeight()">
          <div
            class="pdf-page relative bg-white shadow-xl"
            [class.grid-on]="editor.snapToGrid()"
            [style.width.px]="pageWidth"
            [style.height.px]="pageHeight"
            [style.transform]="'scale(' + scale() + ')'"
            role="group"
            aria-label="A4 page"
            (click)="deselect($event)"
          >
            @for (node of editor.nodes(); track node.id) {
              <div
                class="pdf-node-box"
                [class.is-selected]="editor.selectedId() === node.id"
                [attr.data-node-id]="node.id"
                [attr.data-node-type]="node.type"
                [attr.aria-label]="node.type + ' node ' + node.id"
                [style.left.px]="node.x"
                [style.top.px]="node.y"
                [style.width.px]="node.width"
                [style.height.px]="node.height"
                role="group"
                tabindex="0"
                (click)="selectNode($event, node)"
                (pointerdown)="startMove($event, node)"
                (keydown.enter)="editor.selectedId.set(node.id)"
                (keydown.space)="$event.preventDefault(); editor.selectedId.set(node.id)"
              >
                @if (node.type === 'text') {
                  <div class="preview-text" [style.font-size.px]="node.style.fontSize" [style.font-weight]="node.style.bold ? '700' : '400'" [style.text-align]="node.style.align" [style.color]="node.style.color">
                    @for (part of placeholderParts(node.content); track $index) {
                      @if (part.placeholder) {
                        <span class="placeholder-chip">{{ part.text }}</span>
                      } @else {
                        {{ part.text }}
                      }
                    }
                  </div>
                } @else if (node.type === 'table') {
                  <table class="preview-table" [style.font-size.px]="node.style.fontSize" [style.border-color]="node.style.borderColor">
                    <colgroup>
                      @for (cell of node.rows[0] ?? []; track $index) {
                        <col [style.width.%]="tableColumnWidth(node, $index)" />
                      }
                    </colgroup>
                    <tbody>
                      @for (row of node.rows; track $index; let rowIndex = $index) {
                        <tr [style.background-color]="tableRowFill(node, rowIndex)">
                          @for (cell of row; track $index; let columnIndex = $index) {
                            <td
                              [style.text-align]="node.columnAligns?.[columnIndex] ?? 'left'"
                              [style.font-weight]="(rowIndex === 0 && node.style.headerBold) || node.boldRows?.includes(rowIndex) ? '700' : '400'"
                            >
                              @for (part of placeholderParts(cell); track $index) {
                                @if (part.placeholder) { <span class="placeholder-chip">{{ part.text }}</span> } @else { {{ part.text }} }
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else if (node.type === 'image') {
                  <div class="image-placeholder" [attr.aria-label]="'Image attachment ' + node.attachmentId">
                    <span aria-hidden="true" class="text-3xl">▧</span>
                    <span>Image · {{ node.attachmentId }}</span>
                  </div>
                } @else {
                  <div class="divider-preview" [style.border-top-color]="node.style.color" [style.border-top-width.px]="node.style.thickness"></div>
                }

                @if (editor.selectedId() === node.id) {
                  @for (handle of resizeHandles; track handle) {
                    <button
                      type="button"
                      class="resize-handle"
                      [class]="'resize-handle handle-' + handle"
                      [attr.aria-label]="'Resize ' + node.type + ' node ' + handle"
                      [attr.data-testid]="'resize-' + handle"
                      (pointerdown)="startResize($event, node, handle)"
                      (keydown)="resizeWithKeyboard($event, node, handle)"
                    ></button>
                  }
                }
              </div>
            }
          </div>
        </div>
      </section>

      <aside class="min-h-32 rounded-md border border-dashed border-border p-3" aria-label="Selected element properties">
        <ng-content select="[panel]"></ng-content>
      </aside>
      <p class="sr-only" aria-live="polite" data-testid="editor-announcement">{{ announcement() }}</p>
    </div>
  `,
  styles: `
    :host { display: block; }
    .pdf-page { box-sizing: border-box; transform-origin: top left; background-image: none; }
    .pdf-page.grid-on { background-image: radial-gradient(#d1d5db 0.55px, transparent 0.55px); background-size: 8px 8px; }
    .pdf-node-box { box-sizing: border-box; position: absolute; overflow: visible; outline: 1px solid transparent; cursor: move; user-select: none; }
    .pdf-node-box.is-selected { outline: 1px solid #2563eb; z-index: 1; }
    .preview-text { width: 100%; height: 100%; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
    .placeholder-chip { background: #dbeafe; color: #1d4ed8; border-radius: 2px; padding: 0 2px; font: 10px ui-monospace, monospace; }
    .preview-table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
    .preview-table td { border: 1px solid; border-color: inherit; padding: 2px; overflow: hidden; overflow-wrap: anywhere; }
    .image-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; border: 1px dashed #94a3b8; background: #f1f5f9; color: #475569; font: 10px ui-monospace, monospace; }
    .divider-preview { width: 100%; border-top-style: solid; }
    .resize-handle { position: absolute; width: 10px; height: 10px; padding: 0; border: 1px solid #2563eb; border-radius: 999px; background: white; z-index: 2; }
    .handle-n { left: calc(50% - 5px); top: -5px; cursor: ns-resize; }
    .handle-ne { right: -5px; top: -5px; cursor: nesw-resize; }
    .handle-e { right: -5px; top: calc(50% - 5px); cursor: ew-resize; }
    .handle-se { right: -5px; bottom: -5px; cursor: nwse-resize; }
    .handle-s { left: calc(50% - 5px); bottom: -5px; cursor: ns-resize; }
    .handle-sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
    .handle-w { left: -5px; top: calc(50% - 5px); cursor: ew-resize; }
    .handle-nw { left: -5px; top: -5px; cursor: nwse-resize; }
  `,
})
export class PdfBuilderEditor implements OnChanges, AfterViewInit, OnDestroy {
  readonly nodes = input<PdfNode[]>([]);
  readonly placeholders = input<string[]>([]);
  readonly nodesChange = output<PdfNodeTree>();
  readonly valid = output<boolean>();
  readonly editor = new PdfEditorState();
  readonly validState = signal(true);
  readonly announcement = signal('PDF editor ready');
  readonly nodeTypes: PdfNodeType[] = ['text', 'table', 'image', 'divider'];
  readonly resizeHandles = RESIZE_HANDLES;
  readonly pageWidth = PDF_PAGE_WIDTH;
  readonly pageHeight = PDF_PAGE_HEIGHT;
  readonly scale = signal(1);
  readonly viewportWidth = computed(() => this.pageWidth * this.scale());
  readonly viewportHeight = computed(() => this.pageHeight * this.scale());
  readonly canvasRegion = viewChild<ElementRef<HTMLElement>>('canvasRegion');

  private observer: ResizeObserver | null = null;
  private pointerSession: PointerSession | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['nodes']) return;
    if (JSON.stringify(this.nodes()) === JSON.stringify(this.editor.nodes())) {
      this.updateValidity(true);
      return;
    }
    this.editor.load(this.nodes());
    this.updateValidity(true);
  }

  ngAfterViewInit(): void {
    const region = this.canvasRegion()?.nativeElement;
    if (typeof ResizeObserver === 'undefined' || !region) return;
    this.observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) this.scale.set(Math.min(1, Math.max(0.1, (width - 24) / this.pageWidth)));
    });
    this.observer.observe(region);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  addNode(type: PdfNodeType): void {
    this.editor.addNode(type);
    this.announcement.set(`${type} element added`);
    this.emitCommittedChange();
  }

  insertPlaceholder(name: string): void {
    const selected = this.editor.nodes().find((node) => node.id === this.editor.selectedId());
    if (selected?.type === 'text') {
      this.editor.updateNode(selected.id, { content: `${selected.content}{{${name}}}` });
      this.emitCommittedChange();
      this.announcement.set(`${name} placeholder inserted`);
      return;
    }
    const textNode = this.editor.addNode('text');
    this.editor.updateNode(textNode.id, { content: `{{${name}}}` });
    this.announcement.set(`${name} placeholder inserted`);
    this.emitCommittedChange();
  }

  selectNode(event: MouseEvent, node: PdfNode): void {
    event.stopPropagation();
    this.editor.selectedId.set(node.id);
  }

  deselect(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.editor.selectedId.set(null);
  }

  toggleSnap(): void {
    this.editor.setSnapToGrid(!this.editor.snapToGrid());
    this.announcement.set(`Snap to grid ${this.editor.snapToGrid() ? 'on' : 'off'}`);
  }

  undo(): void {
    if (!this.editor.undo()) return;
    this.announcement.set('Undo');
    this.emitCommittedChange();
  }

  redo(): void {
    if (!this.editor.redo()) return;
    this.announcement.set('Redo');
    this.emitCommittedChange();
  }

  placeholderParts(value: string): PlaceholderPart[] {
    if (typeof value !== 'string') return [];
    const regex = /(?<!\{)\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}(?!\})/g;
    const result: PlaceholderPart[] = [];
    let lastIndex = 0;
    for (const match of value.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) result.push({ text: value.slice(lastIndex, index), placeholder: false });
      result.push({ text: `{{${match[1]}}}`, placeholder: true });
      lastIndex = index + match[0].length;
    }
    if (lastIndex < value.length) result.push({ text: value.slice(lastIndex), placeholder: false });
    if (result.length === 0) result.push({ text: value, placeholder: false });
    return result;
  }

  tableColumnWidth(node: Extract<PdfNode, { type: 'table' }>, columnIndex: number): number {
    const columns = node.rows[0]?.length ?? 0;
    if (columns === 0) return 0;
    const weights = node.columnWidths?.length === columns ? node.columnWidths : Array.from({ length: columns }, () => 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return total > 0 ? ((weights[columnIndex] ?? 0) / total) * 100 : 100 / columns;
  }

  tableRowFill(node: Extract<PdfNode, { type: 'table' }>, rowIndex: number): string | null {
    if (rowIndex === 0 && node.headerFill) return node.headerFill;
    if (rowIndex > 0 && node.zebra && rowIndex % 2 === 1) return '#F8FAFC';
    return null;
  }

  startMove(event: PointerEvent, node: PdfNode): void {
    this.editor.selectedId.set(node.id);
    if (event.button !== 0) return;
    this.startPointerSession(event, node, 'move');
  }

  startResize(event: PointerEvent, node: PdfNode, handle: PdfResizeHandle): void {
    event.stopPropagation();
    event.preventDefault();
    this.editor.selectedId.set(node.id);
    this.startPointerSession(event, node, 'resize', handle);
  }

  resizeWithKeyboard(event: KeyboardEvent, node: PdfNode, handle: PdfResizeHandle): void {
    const delta = event.shiftKey ? 8 : 1;
    let deltaX = 0;
    let deltaY = 0;
    if (event.key === 'ArrowLeft') deltaX = -delta;
    else if (event.key === 'ArrowRight') deltaX = delta;
    else if (event.key === 'ArrowUp') deltaY = -delta;
    else if (event.key === 'ArrowDown') deltaY = delta;
    else return;
    event.preventDefault();
    event.stopPropagation();
    this.editor.resizeNode(node.id, handle, deltaX, deltaY, false);
    this.emitCommittedChange();
  }

  private startPointerSession(event: PointerEvent, node: PdfNode, mode: 'move' | 'resize', handle?: PdfResizeHandle): void {
    event.preventDefault();
    this.editor.beginTransaction();
    this.pointerSession = {
      id: node.id,
      mode,
      handle,
      lastX: event.clientX,
      lastY: event.clientY,
      initialJSON: JSON.stringify(this.editor.nodes()),
    };
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const session = this.pointerSession;
    if (!session) return;
    const scale = Math.max(this.scale(), 0.1);
    const deltaX = (event.clientX - session.lastX) / scale;
    const deltaY = (event.clientY - session.lastY) / scale;
    if (session.mode === 'move') this.editor.moveNode(session.id, deltaX, deltaY);
    else if (session.handle) this.editor.resizeNode(session.id, session.handle, deltaX, deltaY);
    session.lastX = event.clientX;
    session.lastY = event.clientY;
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    const session = this.pointerSession;
    if (!session) return;
    this.editor.commitTransaction();
    this.pointerSession = null;
    if (session.initialJSON !== JSON.stringify(this.editor.nodes())) this.emitCommittedChange();
  }

  onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.matches('input, textarea, select, [contenteditable="true"]') ||
      (target.tagName === 'BUTTON' && !target.classList.contains('resize-handle'))
    )) return;
    const command = event.ctrlKey || event.metaKey;
    const selectedId = this.editor.selectedId();
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      if (selectedId) {
        this.editor.duplicateNode(selectedId);
        this.announcement.set('Element duplicated');
        this.emitCommittedChange();
      }
      return;
    }
    if (event.key === 'Escape') {
      this.editor.selectedId.set(null);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedId) {
        event.preventDefault();
        this.editor.deleteNode(selectedId);
        this.announcement.set('Element deleted');
        this.emitCommittedChange();
      }
      return;
    }
    if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 8 : 1;
      const deltaX = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const deltaY = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      this.editor.moveNode(selectedId, deltaX, deltaY, false);
      this.emitCommittedChange();
    }
  }

  private updateValidity(emit: boolean): void {
    const isValid = validateNodes(this.editor.nodes()).length === 0;
    this.validState.set(isValid);
    if (emit) this.valid.emit(isValid);
  }

  private emitCommittedChange(): void {
    this.updateValidity(true);
    this.nodesChange.emit(this.editor.toJSON());
  }
}
