/**
 * Base repository
 *
 * Every feature repository (UserRepository, SurahRepository, …)
 * extends this class.  It lazily resolves the DB connection on first use,
 * so repositories can be instantiated before DatabaseService.initialize()
 * completes without throwing.
 */

import { inject } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DatabaseService } from '../database/database.service';

export abstract class BaseRepository {
  // Store the service reference, NOT the connection (which may not exist yet)
  private readonly dbService: DatabaseService;

  constructor() {
    this.dbService = inject(DatabaseService);
  }

  /** Lazily resolved connection — safe to call only after initialize() */
  private get db(): SQLiteDBConnection {
    return this.dbService.getDb();
  }

  /**
   * Execute a query that returns rows.
   * @example
   *   const rows = await this.query<User>('SELECT * FROM users WHERE id = ?', [id]);
   */
  protected async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.db.query(sql, params);
    return (result.values ?? []) as T[];
  }

  /**
   * Execute a statement that modifies the database (INSERT / UPDATE / DELETE).
   * Returns the last insert rowid.
   */
  protected async run(sql: string, params: any[] = []): Promise<number> {
    const result = await this.db.run(sql, params, false);
    return result.changes?.lastId ?? 0;
  }

  /** Build a safe SET clause from a plain object (excludes undefined values). */
  protected buildSetClause(data: Record<string, any>): {
    clause: string;
    values: any[];
  } {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    const clause = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    return { clause, values };
  }
}
