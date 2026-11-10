import { Injectable, computed, signal } from '@angular/core';

export type LoadingBarState = 'idle' | 'loading' | 'success' | 'error';

/** Tracks in-flight requests so the top loading bar can show progress, success or failure. */
@Injectable({ providedIn: 'root' })
export class LoadingBarService {
  private readonly pending = signal(0);
  private readonly failed = signal(false);
  private readonly finished = signal<'success' | 'error' | null>(null);
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = computed<LoadingBarState>(() => {
    if (this.pending() > 0) return 'loading';
    return this.finished() ?? 'idle';
  });

  start(): void {
    this.clearTimer();
    if (this.pending() === 0) {
      this.failed.set(false);
      this.finished.set(null);
    }
    this.pending.update((count) => count + 1);
  }

  /** Marks one request as done; the bar turns red when any request in the batch failed or was cancelled. */
  complete(ok: boolean): void {
    if (this.pending() === 0) return;
    if (!ok) this.failed.set(true);
    this.pending.update((count) => count - 1);
    if (this.pending() > 0) return;
    this.finished.set(this.failed() ? 'error' : 'success');
    this.clearTimer();
    this.resetTimer = setTimeout(() => this.finished.set(null), 700);
  }

  private clearTimer(): void {
    if (this.resetTimer !== null) clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
}
