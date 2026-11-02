import { Component, computed, input, signal } from '@angular/core';

type AvatarSize = 'sm' | 'lg';

const avatarColors = [
  { lightBackground: '#dbeafe', lightForeground: '#1e3a8a', darkBackground: '#1e3a8a', darkForeground: '#dbeafe' },
  { lightBackground: '#d1fae5', lightForeground: '#064e3b', darkBackground: '#064e3b', darkForeground: '#d1fae5' },
  { lightBackground: '#fef3c7', lightForeground: '#78350f', darkBackground: '#78350f', darkForeground: '#fef3c7' },
  { lightBackground: '#ffe4e6', lightForeground: '#881337', darkBackground: '#881337', darkForeground: '#ffe4e6' },
  { lightBackground: '#ede9fe', lightForeground: '#4c1d95', darkBackground: '#4c1d95', darkForeground: '#ede9fe' },
  { lightBackground: '#cffafe', lightForeground: '#164e63', darkBackground: '#164e63', darkForeground: '#cffafe' },
] as const;

@Component({
  selector: 'app-avatar',
  standalone: true,
  styles: [`
    :host { display: inline-grid; flex: 0 0 auto; vertical-align: middle; }
    [data-avatar] {
      display: inline-grid;
      flex: 0 0 auto;
      aspect-ratio: 1 / 1;
      place-items: center;
      overflow: hidden;
      border-radius: 50%;
      font-weight: 600;
      line-height: 1;
      background-color: var(--avatar-bg);
      color: var(--avatar-fg);
    }
    :host-context(.dark) [data-avatar] {
      background-color: var(--avatar-dark-bg);
      color: var(--avatar-dark-fg);
    }
    [data-avatar] img { display: block; width: 100%; height: 100%; object-fit: cover; }
  `],
  template: `
    <span
      data-avatar
      role="img"
      [attr.aria-label]="'Avatar for ' + displayName()"
      class="inline-grid shrink-0 aspect-square place-items-center overflow-hidden rounded-full font-semibold"
      [style.width.px]="avatarSize()"
      [style.height.px]="avatarSize()"
      [style.font-size.px]="fontSize()"
      [style.--avatar-bg]="colorPair().lightBackground"
      [style.--avatar-fg]="colorPair().lightForeground"
      [style.--avatar-dark-bg]="colorPair().darkBackground"
      [style.--avatar-dark-fg]="colorPair().darkForeground"
    >
      @if (showImage()) {
        <img [src]="imageUrl()" [alt]="'Avatar for ' + displayName()" (error)="onImageError()" />
      } @else {
        <span aria-hidden="true">{{ initials() }}</span>
      }
    </span>
  `,
})
export class Avatar {
  readonly name = input<string | null>('Account');
  readonly imageUrl = input<string | null>(null);
  readonly size = input<AvatarSize>('sm');
  private readonly failedImageUrl = signal<string | null>(null);
  protected readonly displayName = computed(() => this.name()?.trim() || 'Account');
  protected readonly showImage = computed(() => Boolean(this.imageUrl()) && this.failedImageUrl() !== this.imageUrl());
  protected readonly initials = computed(() => {
    const parts = this.displayName().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase() || 'A';
  });
  protected readonly colorPair = computed(() => {
    let hash = 0;
    for (const character of this.displayName()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return avatarColors[hash % avatarColors.length];
  });
  protected readonly avatarSize = computed(() => this.size() === 'lg' ? 96 : 28);
  protected readonly fontSize = computed(() => this.size() === 'lg' ? 30 : 10);

  protected onImageError(): void {
    this.failedImageUrl.set(this.imageUrl());
  }
}
