import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Migration } from './migrations/migration.interface';
import { ALL_MIGRATIONS } from './index';

/**
 * MigrationRunner
 *
 * Applies pending migrations in order, tracking each one in the
 * `schema_migrations` table so they are never run twice.
 *
 * Usage (called automatically by DatabaseService):
 *   await this.migrationRunner.run(db);
 */
@Injectable({ providedIn: 'root' })
export class MigrationRunner {

  /**
   * Run all pending migrations against the open DB connection.
   * Migration 001 is special: it creates schema_migrations itself.
   */
  async run(db: SQLiteDBConnection): Promise<void> {
    const applied = await this.getAppliedVersions(db);

    const pending = ALL_MIGRATIONS
      .filter(m => !applied.includes(m.version))
      .sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      await this.applyMigration(db, migration);
    }
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private async getAppliedVersions(db: SQLiteDBConnection): Promise<number[]> {
    try {
      const result = await db.query(
        `SELECT version FROM schema_migrations ORDER BY version ASC`
      );
      return (result.values ?? []).map((r: any) => r.version as number);
    } catch {
      // Table may not exist yet (before migration 001 runs)
      return [];
    }
  }

  private async applyMigration(
    db: SQLiteDBConnection,
    migration: Migration
  ): Promise<void> {
    console.log(`[DB] Applying migration ${migration.version}: ${migration.description}`);
    try {
      await migration.up(db);
      await db.run(
        `INSERT INTO schema_migrations (version, description) VALUES (?, ?)`,
        [migration.version, migration.description]
      );
      console.log(`[DB] Migration ${migration.version} applied ✔`);
    } catch (err) {
      console.error(`[DB] Migration ${migration.version} FAILED – rolling back`, err);
      await migration.down(db).catch(e =>
        console.error('[DB] Rollback also failed', e)
      );
      throw err;
    }
  }
}
