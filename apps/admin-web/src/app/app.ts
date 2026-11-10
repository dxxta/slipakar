import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingBar } from './ui/shared/loading-bar';
import { HlmToasterImports } from './ui/sonner/src/index';

@Component({
  imports: [LoadingBar, RouterOutlet, ...HlmToasterImports],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
