import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown } from '@ng-icons/tabler-icons';
import { Avatar } from '@slipakar/ui/avatar';
import { ThemeToggle } from './theme-toggle';

@Component({
  selector: 'app-account-menu',
  imports: [Avatar, ThemeToggle, NgIcon],
  providers: [provideIcons({ tablerChevronDown })],
  template: `
    <div class="flex min-w-0 items-center gap-2">
      <app-theme-toggle />
      <div class="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        aria-label="Account menu"
        class="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-ui-md px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        (click)="open.update((value) => !value)"
      >
        <app-avatar size="sm" [name]="name() || email()" [imageUrl]="imageUrl()" />
        <span class="flex min-w-0 flex-1 flex-col truncate"><span class="truncate text-sm font-medium">{{ name() || email() || 'Account' }}</span>@if (name() && email()) { <span class="truncate text-xs text-muted-foreground">{{ email() }}</span> }</span>
        <span class="text-muted-foreground" aria-hidden="true"><ng-icon name="tablerChevronDown" class="size-4 transition-transform" [class.rotate-180]="open()" /></span>
      </button>
      @if (open()) {
        <div role="menu" aria-label="Account actions" class="absolute bottom-full left-0 z-20 mb-2 w-full rounded-ui-md border border-border bg-popover p-1 shadow-lg">
          <button role="menuitem" type="button" class="min-h-11 w-full rounded-ui-sm px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="signOutRequested.emit(); open.set(false)">Sign out</button>
        </div>
      }
      </div>
    </div>
  `,
})
export class AccountMenu {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly email = input<string | null>(null);
  readonly name = input<string | null>(null);
  readonly imageUrl = input<string | null>(null);
  readonly signOutRequested = output<void>();
  readonly open = signal(false);

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.open.set(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected closeOnOutsidePointer(event: PointerEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }
}
