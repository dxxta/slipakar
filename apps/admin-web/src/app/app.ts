import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingBar } from './ui/shared/loading-bar';

@Component({
  imports: [LoadingBar, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
