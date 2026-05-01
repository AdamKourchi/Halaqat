import { Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { MigrationRunner } from './migration-runner.service';

export const DB_NAME = 'hifd_db';

/**
 * DatabaseService
 *
 * Single source of truth for the SQLite connection.
 * All feature services (UserService, SurahService, …) inject this and
 * call `getDb()` to get the open connection.
 *
 * Lifecycle:
 *   AppComponent.initializeApp()
 *     → DatabaseService.initialize()
 *       → MigrationRunner.run()
 *
 * This version is fully native (Android/iOS) and does not contain web support.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;
  private _ready = false;

  /**
   * Resolves when initialize() completes successfully.
   * Await this in any page/service before calling getDb().
   *
   * Usage:
   *   await this.dbService.ready$;
   *   const rows = this.dbService.getDb().query(...);
   */
  readonly ready$: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (err: unknown) => void;

  constructor(private migrationRunner: MigrationRunner) {
    this.ready$ = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady  = reject;
    });
  }

  /** Called once at application boot (AppComponent). */
  async initialize(): Promise<void> {
    if (this._ready) return;

    try {
      // Hot reload resilience: check if connection already exists
      try {
        await this.sqlite.checkConnectionsConsistency();
      } catch (e) {
        console.warn('checkConnectionsConsistency failed', e);
      }
      
      const isConn = await this.sqlite.isConnection(DB_NAME, false);
      if (isConn.result) {
        this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      const isOpen = await this.db.isDBOpen();
      if (!isOpen.result) {
        await this.db.open();
      }

      await this.migrationRunner.run(this.db);

      this._ready = true;
      this.resolveReady();
      console.log('[DB] Database ready ✔');
    } catch (error) {
      this.rejectReady(error);
      console.error('[DB] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Returns the open DB connection.
   * Only safe to call after `await ready$` has resolved.
   */
  getDb(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('DatabaseService: getDb() called before initialize()');
    }
    return this.db;
  }

  /** Close the DB connection (call on app destroy if needed). */
  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection(DB_NAME, false);
    }
  }

  /** Run the database seeder */
  async seedDatabase(): Promise<void> {
    const db = this.getDb();
    const { seedHalaqatData } = await import('./seeders/test_seeder');
    await seedHalaqatData(db);
  }
}
