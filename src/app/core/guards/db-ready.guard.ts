import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { DatabaseService } from '../database/database.service';

/**
 * DbReadyGuard
 *
 * Blocks navigation to any route until the SQLite database has been
 * fully initialized and all migrations applied.
 *
 * Usage in app.routes.ts:
 *   { path: 'home', canActivate: [DbReadyGuard], loadComponent: … }
 */
@Injectable({ providedIn: 'root' })
export class DbReadyGuard implements CanActivate {
  constructor(private dbService: DatabaseService, private router: Router) {}

  canActivate(): boolean {
    try {
      this.dbService.getDb(); // throws if not initialized
      return true;
    } catch {
      this.router.navigate(['/loading']);
      return false;
    }
  }
}
