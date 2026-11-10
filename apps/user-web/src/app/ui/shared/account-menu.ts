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
    <div class="relative min-w-0 w-full">
      <button
        type="button"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        aria-label="Account menu"
        class="flex h-control-9 w-full min-w-0 items-center gap-2 rounded-ui-md px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
        (click)="open.update((value) => !value)"
      >
        <app-avatar size="sm" [name]="name() || email()" [imageUrl]="imageUrl()" />
        @if (!collapsed()) {
          <span class="flex min-w-0 flex-1 flex-col truncate"><span class="truncate text-sm font-medium">{{ name() || email() || 'Account' }}</span>@if (name() && email()) { <span class="truncate text-xs text-muted-foreground">{{ email() }}</span> }</span>
          <span class="text-muted-foreground" aria-hidden="true"><ng-icon name="tablerChevronDown" class="size-4 transition-transform" [class.rotate-180]="open()" /></span>
        }
      </button>
      @if (open()) {
        <div role="menu" aria-label="Account actions" [class.left-0]="!collapsed()" [class.left-full]="collapsed()" [class.bottom-full]="!collapsed()" [class.bottom-0]="collapsed()" [class.ml-2]="collapsed()" class="absolute z-20 mb-2 min-w-56 rounded-ui-md border border-border bg-popover p-1 shadow-lg">
          <app-theme-toggle />
          <button role="menuitem" type="button" class="h-control-9 w-full rounded-ui-sm px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11" (click)="signOutRequested.emit(); open.set(false)">Sign out</button>
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
  private readonly host = inject(ElementRef<HTMLElement>);

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
