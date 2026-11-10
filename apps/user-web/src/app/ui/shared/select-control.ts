import { Directive } from '@angular/core';

@Directive({
  selector: 'select[appSelect]',
  host: { class: 'app-select h-control-9' },
})
export class SelectControl {}
