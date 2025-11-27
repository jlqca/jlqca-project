import { Routes } from '@angular/router';
import { Home } from './home/home';
import { CanvasBoardComponent } from './canvas-board/canvas-board';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'JLQCA Project - Home'
  },
  {
    path: 'canvas-board',
    component: CanvasBoardComponent,
    title: 'Lousa Colaborativa - JLQCA Project'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
