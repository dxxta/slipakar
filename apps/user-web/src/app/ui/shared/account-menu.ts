import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerLogout } from '@ng-icons/tabler-icons';
import { Avatar } from '@slipakar/ui/avatar';
import { ThemeToggle } from './theme-toggle';
import { Ripple } from './ripple';

@Component({
  selector: 'app-account-menu',
  imports: [Ripple, Avatar, ThemeToggle, NgIcon],
  providers: [provideIcons({ tablerChevronDown, tablerLogout })],
  template: `
    <div class="relative min-w-0 w-full">
      <button
        type="button"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        aria-label="Account menu"
        class="flex h-control-9 w-full min-w-0 items-center gap-2 rounded-ui-md px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        (click)="toggle()"
      >
        <app-avatar size="sm" [name]="name() || email()" [imageUrl]="imageUrl()" />
        @if (!collapsed()) {
          <span class="flex min-w-0 flex-1 flex-col truncate"><span class="truncate text-sm font-medium">{{ name() || email() || 'Account' }}</span>@if (name() && email()) { <span class="truncate text-xs text-muted-foreground">{{ email() }}</span> }</span>
          <span class="text-muted-foreground" aria-hidden="true"><ng-icon name="tablerChevronDown" class="size-4 transition-transform" [class.rotate-180]="open()" /></span>
        }
      </button>
      @if (open()) {
        <div role="menu" aria-label="Account actions" class="account-actions-menu fixed z-[80] w-max rounded-ui-md border border-border bg-popover p-1 text-popover-foreground shadow-lg" [style.left.px]="position().left" [style.bottom.px]="position().bottom">
          <app-theme-toggle />
          <button role="menuitem" type="button" class="account-menu-signout flex h-control-9 w-full items-center gap-2 px-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="signOutRequested.emit(); open.set(false)">
            <ng-icon name="tablerLogout" aria-hidden="true" class="size-4" />
            <span>Sign out</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class AccountMenu {
  readonly email = input<string | null>(null);
  readonly name = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly collapsed = input(false);
  readonly signOutRequested = output<void>();
  readonly open = signal(false);
  protected readonly position = signal({ left: 8, bottom: 8 });
  private readonly host = inject(ElementRef<HTMLElement>);

  protected toggle(): void {
    if (!this.open()) {
      const root = this.host.nativeElement as HTMLElement;
      const bounds = root.querySelector('button')?.getBoundingClientRect();
      const view = root.ownerDocument.defaultView;
      if (bounds && view) {
        const menuWidth = 224;
        const rightAlignedLeft = Math.max(8, Math.min(bounds.right - menuWidth, view.innerWidth - menuWidth - 8));
        const collapsedLeft = bounds.right + 8 + menuWidth <= view.innerWidth ? bounds.right + 8 : rightAlignedLeft;
        const left = this.collapsed() ? collapsedLeft : rightAlignedLeft;
        const bottom = this.collapsed() ? Math.max(8, view.innerHeight - bounds.bottom) : view.innerHeight - bounds.top + 8;
        this.position.set({ left, bottom });
      }
    }
    this.open.update((value) => !value);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected closeOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.open.set(false);
  }
}
