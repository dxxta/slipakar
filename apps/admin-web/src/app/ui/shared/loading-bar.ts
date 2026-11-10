import { Component, inject } from '@angular/core';
import { LoadingBarService } from '../../core/loading-bar.service';

@Component({
  selector: 'app-loading-bar',
  host: { class: 'pointer-events-none fixed inset-x-0 top-0 z-[100] block h-[3px]' },
  template: `
    <div
      role="progressbar"
      aria-label="Loading"
      class="h-full origin-left transition-[transform,opacity,background-color] duration-300 ease-out motion-reduce:transition-none"
      [attr.aria-hidden]="bar.state() === 'idle'"
      [attr.data-state]="bar.state()"
      [class.bg-primary]="bar.state() === 'loading'"
      [class.bg-green-600]="bar.state() === 'success'"
      [class.bg-destructive]="bar.state() === 'error'"
      [class.opacity-0]="bar.state() === 'idle'"
      [class.loading-bar-running]="bar.state() === 'loading'"
      [style.transform]="bar.state() === 'idle' ? 'scaleX(0)' : bar.state() === 'loading' ? null : 'scaleX(1)'"
    ></div>
  `,
})
export class LoadingBar {
  protected readonly bar = inject(LoadingBarService);
}
