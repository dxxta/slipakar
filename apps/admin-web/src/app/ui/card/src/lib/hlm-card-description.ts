import { Directive } from '@angular/core';
import { classes } from '@lokaslip/ui/utils';

@Directive({
  selector: '[hlmCardDescription]',
  exportAs: 'hlmCardDescription',
  host: { 'data-slot': 'card-description' },
})
export class HlmCardDescription {
  constructor() {
    classes(() => 'text-muted-foreground text-sm');
  }
}
