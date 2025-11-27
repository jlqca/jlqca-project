import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
  standalone: true
})
export class Home {

  constructor(private router: Router) {}

  // Navegar para a lousa colaborativa
  openCanvasBoard() {
    this.router.navigate(['/canvas-board']);
  }
}
