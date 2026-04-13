import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: 'circle-details/:id',
    loadComponent: () =>
      import('./features/circle-details/circle-details.component').then(
        (m) => m.CircleDetailsComponent,
      ),
  },
  {
    path: 'student-profile/:id',
    loadComponent: () =>
      import('./features/student-profile/student-profile.component').then(
        (m) => m.StudentProfileComponent,
      ),
  },
];
