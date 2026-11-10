import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPencil } from '@ng-icons/tabler-icons';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../core/session.service';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { contrastRatio, isHexColor, readableForeground, type BaseColorKey, type ThemeAccent, type ThemeMode } from '../../core/theme-preferences';
import { Avatar } from '@slipakar/ui/avatar';
import { HlmButton } from '../../ui/button/src';
import { PageHeader, SelectControl } from '../../ui';
import { Ripple } from '../../ui/shared/ripple';

@Component({
  selector: 'app-profile-page',
  imports: [Ripple, CommonModule, Avatar, HlmButton, PageHeader, SelectControl, NgIcon],
  providers: [provideIcons({ tablerPencil })],
  template: `
    <div class="space-y-6">
    <app-page-header
      title="Profile"
      badge="Account"
      [topLevel]="true"
      description="Manage your name, avatar, and account email."
    />

    <br/>

    @if (success()) {
      <p role="status" class="rounded-ui-md bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
        {{ success() }}
      </p>
    }
    @if (error()) {
      <p role="alert" class="rounded-ui-md bg-destructive/10 p-3 text-sm text-destructive">
        {{ error() }}
      </p>
    }

    <section class="grid items-start gap-6 rounded-ui-lg border border-border bg-card p-card md:grid-cols-[8rem_minmax(0,1fr)]" aria-label="Profile details">
      <div class="grid justify-items-start md:pt-1">
        <input
          #avatarInput
          id="avatar-file"
          class="sr-only"
          type="file"
          aria-label="Avatar image file"
          accept="image/png,image/jpeg,image/webp"
          (change)="uploadAvatar($event)"
        />
        <button
          data-testid="profile-avatar"
          type="button"
          aria-label="Change avatar"
          class="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          [disabled]="avatarUploading()"
          (click)="avatarInput.click()"
        >
          <app-avatar
            [name]="name() || session.user()?.name || session.user()?.email || 'Account'"
            [imageUrl]="image() || null"
            [size]="'xl'"
          />
          <span
            class="absolute inset-0 grid place-items-center rounded-full bg-foreground/55 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          >
            <ng-icon name="tablerPencil" class="size-7" />
          </span>
        </button>
      </div>
      <form class="space-y-4" (submit)="$event.preventDefault(); saveProfile()">
        <div class="grid gap-2">
          <label for="profile-name" class="text-sm font-medium">Name</label>
          <input
            id="profile-name"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Your name"
            [value]="name()"
            (input)="name.set(inputValue($event))"
            required
            maxlength="100"
          />
        </div>
        <div class="grid gap-2">
          <label for="avatar-url" class="text-sm font-medium">Avatar URL</label>
          <div class="avatar-url-group flex h-control-9 min-w-0 overflow-hidden rounded-ui-md border border-input bg-background">
            <input
              id="avatar-url"
              data-testid="avatar-url"
              class="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-muted-foreground outline-none"
              type="text"
              [value]="image()"
              placeholder="No custom avatar"
              readonly
              aria-readonly="true"
            />
            <button
              hlmBtn
              variant="ghost"
              type="button"
              data-action="remove-avatar"
              class="avatar-url-remove h-full shrink-0 rounded-none border-0 border-l border-input px-4 leading-none text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
              [disabled]="avatarUploading() || !image()"
              (click)="removeAvatar()"
            >
              Remove
            </button>
          </div>
          <p class="text-xs text-muted-foreground">PNG, JPEG, or WebP up to 2 MB.</p>
        </div>
        <button hlmBtn type="submit" data-action="save-profile" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save profile' }}
        </button>
      </form>
    </section>

    <section class="space-y-4 rounded-ui-lg border border-border bg-card p-card" aria-labelledby="email-heading">
      <div>
        <h2 id="email-heading" class="text-lg font-semibold">Email address</h2>
        <p class="mt-1 text-sm text-muted-foreground">Current email: <strong>{{ session.user()?.email }}</strong></p>
      </div>
      <form class="space-y-4" (submit)="$event.preventDefault(); requestEmailChange()">
        <div class="grid gap-2">
          <label for="profile-email" class="text-sm font-medium">New email</label>
          <input
            id="profile-email"
            type="email"
            autocomplete="email"
            class="h-control-9 rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="name@example.com"
            [value]="newEmail()"
            (input)="newEmail.set(inputValue($event))"
            required
          />
        </div>
        <button
          hlmBtn
          type="submit"
          data-action="request-email-change"
          [disabled]="emailSending() || !newEmail().trim()"
        >
          {{ emailSending() ? 'Sending…' : 'Send verification link' }}
        </button>
      </form>
      @if (pendingEmail()) {
        <p role="status" class="text-sm text-emerald-700 dark:text-emerald-300">Check {{ pendingEmail() }} to confirm</p>
      }
    </section>

    <section class="space-y-5 rounded-ui-lg border border-border bg-card p-card" aria-labelledby="appearance-heading">
      <div>
        <h2 id="appearance-heading" class="text-lg font-semibold">Appearance</h2>
        <p class="mt-1 text-sm text-muted-foreground">Choose how Slipakar looks on this device and your account.</p>
      </div>
      <div class="grid gap-5 sm:grid-cols-2">
        <div class="grid content-start gap-2">
          <label for="theme-mode" class="text-sm font-medium">Color theme</label>
          <select
            id="theme-mode"
            appSelect
            class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm"
            [value]="themePreferences.preference().themeMode"
            (change)="changeThemeMode($event)"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <fieldset class="m-0 min-w-0 border-0 p-0 sm:col-span-2">
          <legend class="mb-2 p-0 text-sm font-medium">Base colours · {{ activeSchemeLabel() }} theme</legend>
          <div class="grid gap-4 sm:grid-cols-3">
            @for (field of baseColorFields; track field.key) {
              <label class="grid min-w-0 content-start gap-2 rounded-ui-md border border-border bg-muted/40 p-3">
                <span class="text-sm font-medium">{{ field.label }}</span>
                <span class="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    class="base-color-picker"
                    [value]="baseColorValue(field.key)"
                    [attr.aria-label]="field.label + ' color picker'"
                    (input)="changeBaseColor(field.key, $event)"
                  />
                  <input
                    type="text"
                    class="base-color-hex min-w-0 flex-1"
                    [value]="baseColorDraft(field.key)"
                    [attr.aria-label]="field.label + ' hex value'"
                    [attr.aria-invalid]="baseColorDraftInvalid(field.key) ? 'true' : null"
                    placeholder="#D4F03C"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxlength="7"
                    spellcheck="false"
                    (input)="changeBaseColorHex(field.key, $event)"
                  />
                </span>
                @if (baseColorDraftInvalid(field.key)) {
                  <span class="text-xs text-destructive">Enter a color in #RRGGBB format.</span>
                }
                @if (field.key === 'accent') {
                  <span role="group" class="flex flex-wrap gap-2 pt-1" aria-label="Accent presets">
                    @for (accent of accents; track accent) {
                      <button
                        type="button"
                        class="theme-accent-swatch grid size-9 place-items-center rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        [attr.aria-label]="accentLabel(accent)"
                        [attr.aria-pressed]="baseColorValue('accent').toUpperCase() === accentColor(accent)"
                        (click)="themePreferences.setAccent(accent); syncAccentDraft()"
                      >
                        <span class="size-6 rounded-full" [style.backgroundColor]="accentColor(accent)" aria-hidden="true"></span>
                      </button>
                    }
                  </span>
                }
              </label>
            }
          </div>
          @if (accentContrastWarning()) {
            <p role="status" class="mt-3 text-xs text-muted-foreground">This accent has less than 4.5:1 contrast with ink or white text. It is still allowed.</p>
          }
          <button hlmBtn variant="outline" type="button" class="mt-3" (click)="resetBaseColors()">Reset to default</button>
        </fieldset>
      </div>
      <div data-theme-preview aria-live="polite" class="flex flex-wrap items-center justify-between gap-4 rounded-ui-md border border-border bg-muted p-4">
        <div>
          <p class="text-sm font-medium">Live preview</p>
          <p class="mt-1 text-xs text-muted-foreground">Your accent and theme are applied immediately.</p>
        </div>
        <button hlmBtn type="button">Preview action</button>
      </div>
    </section>
    </div>
  `,
})
export class ProfilePage {
  protected readonly session = inject(SessionService);
  protected readonly themePreferences = inject(ThemePreferencesService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly name = signal('');
  readonly image = signal('');
  readonly newEmail = signal('');
  readonly pendingEmail = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly avatarUploading = signal(false);
  readonly emailSending = signal(false);
  protected readonly accents: ThemeAccent[] = ['slate', 'blue', 'green', 'violet', 'rose', 'amber'];
  protected readonly baseColorFields: { key: BaseColorKey; label: string }[] = [
    { key: 'accent', label: 'Accent' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'third', label: 'Third' },
  ];
  private readonly baseColorDrafts = signal<Record<string, string>>({});

  constructor() {
    const user = this.session.user();
    this.name.set(user?.name ?? '');
    this.image.set(user?.image ?? '');
    const oldEmail = sessionStorage.getItem('slipakar:pending-email-old');
    void this.session.loadSession().then((updated) => {
      if (updated?.name) this.name.set(updated.name);
      if (updated?.image) this.image.set(updated.image);
      if (oldEmail && updated && updated.email !== oldEmail) {
        sessionStorage.removeItem('slipakar:pending-email-old');
        sessionStorage.removeItem('slipakar:pending-email-new');
        this.success.set('Your email address has been updated.');
      }
    });
    const pending = sessionStorage.getItem('slipakar:pending-email-new');
    if (pending) this.pendingEmail.set(pending);
  }

  saveProfile(): void {
    const name = this.name().trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post('/api/auth/update-user', { name }).subscribe({
      next: () => {
        void this.session.loadSession().then((updated) => {
          if (updated?.name) this.name.set(updated.name);
          this.success.set('Profile saved successfully.');
          this.saving.set(false);
        });
      },
      error: () => {
        this.error.set('Could not save your profile. Please try again.');
        this.saving.set(false);
      },
    });
  }

  uploadAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.error.set('Please select a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('Image must be under 2 MB.');
      return;
    }

    this.avatarUploading.set(true);
    this.error.set(null);
    this.success.set(null);

    const formData = new FormData();
    formData.append('file', file, file.name);

    this.http.post<{ message: string; data: { url: string } }>('/me/avatar', formData).subscribe({
      next: (response) => {
        this.image.set(response.data.url);
        void this.session.loadSession().then(() => {
          this.avatarUploading.set(false);
          this.success.set('Avatar updated successfully.');
        });
      },
      error: () => {
        this.error.set('Could not upload your avatar. Please try again.');
        this.avatarUploading.set(false);
      },
    });
  }

  removeAvatar(): void {
    this.avatarUploading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.delete('/me/avatar').subscribe({
      next: () => {
        this.image.set('');
        void this.session.loadSession().then(() => {
          this.avatarUploading.set(false);
          this.success.set('Avatar removed.');
        });
      },
      error: () => {
        this.error.set('Could not remove avatar. Please try again.');
        this.avatarUploading.set(false);
      },
    });
  }

  requestEmailChange(): void {
    const newEmail = this.newEmail().trim();
    if (!newEmail || this.emailSending()) return;
    this.emailSending.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post('/api/auth/change-email', { newEmail, callbackURL: '/profile' }).subscribe({
      next: () => {
        const current = this.session.user();
        if (current?.email) sessionStorage.setItem('slipakar:pending-email-old', current.email);
        sessionStorage.setItem('slipakar:pending-email-new', newEmail);
        this.pendingEmail.set(newEmail);
        this.newEmail.set('');
        this.emailSending.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.error?.code === 'EMAIL_CHANGE_UNAVAILABLE') {
          this.error.set('Email verification is unavailable in this environment.');
        } else {
          this.error.set(err.error?.message || 'Could not send verification email. Please try again.');
        }
        this.emailSending.set(false);
      },
    });
  }

  changeThemeMode(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.themePreferences.setMode(select.value as ThemeMode);
    this.baseColorDrafts.set({});
  }

  accentLabel(accent: ThemeAccent): string {
    if (accent === 'slate') return 'Lime accent';
    return `${accent.charAt(0).toUpperCase()}${accent.slice(1)} accent`;
  }

  accentColor(accent: ThemeAccent): string {
    const colors: Record<ThemeAccent, string> = {
      slate: '#D4F03C',
      blue: '#2563EB',
      green: '#166534',
      violet: '#6D28D9',
      rose: '#BE123C',
      amber: '#D97706',
    };
    return colors[accent];
  }

  protected activeSchemeLabel(): string {
    return this.themePreferences.activeScheme() === 'dark' ? 'Dark' : 'Light';
  }

  protected baseColorValue(key: BaseColorKey): string {
    return this.themePreferences.themeColors()[this.themePreferences.activeScheme()][key];
  }

  protected baseColorDraft(key: BaseColorKey): string {
    return this.baseColorDrafts()[this.baseColorDraftKey(key)] ?? this.baseColorValue(key);
  }

  protected baseColorDraftInvalid(key: BaseColorKey): boolean {
    return !isHexColor(this.baseColorDraft(key));
  }

  protected changeBaseColor(key: BaseColorKey, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value.toUpperCase();
    this.baseColorDrafts.update((drafts) => ({ ...drafts, [this.baseColorDraftKey(key)]: value }));
    this.themePreferences.setBaseColor(this.themePreferences.activeScheme(), key, value);
  }

  protected changeBaseColorHex(key: BaseColorKey, event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    this.baseColorDrafts.update((drafts) => ({ ...drafts, [this.baseColorDraftKey(key)]: value }));
    if (isHexColor(value)) this.themePreferences.setBaseColor(this.themePreferences.activeScheme(), key, value);
  }

  protected syncAccentDraft(): void {
    this.baseColorDrafts.update((drafts) => ({ ...drafts, [this.baseColorDraftKey('accent')]: this.baseColorValue('accent') }));
  }

  protected accentContrastWarning(): boolean {
    const accent = this.baseColorValue('accent');
    return contrastRatio(accent, readableForeground(accent)) < 4.5;
  }

  protected resetBaseColors(): void {
    this.themePreferences.resetBaseColors(this.themePreferences.activeScheme());
    this.baseColorDrafts.set({});
  }

  private baseColorDraftKey(key: BaseColorKey): string {
    return `${this.themePreferences.activeScheme()}:${key}`;
  }

  protected inputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value;
  }
}
