import { Directive } from '@angular/core';

@Directive({
  selector: 'select[appSelect]',
  host: { class: 'app-select h-control-9 max-md:min-h-11' },
})
export class SelectControl {}
