import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Migration } from './migration.interface';

/**
 * Migration 001 – Initial schema
 *
 * Creates the bookkeeping table + the full users table with
 * password_hash, role, and created_at as defined in the spec.
 */
export const migration001: Migration = {
  version: 1,
  description: 'Initial schema – schema_migrations & users',

  async up(db: SQLiteDBConnection): Promise<void> {
    // ── schema_migrations bookkeeping table ────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER PRIMARY KEY,
        description TEXT    NOT NULL,
        applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // ── users ──────────────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'TEACHER',
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },

  async down(db: SQLiteDBConnection): Promise<void> {
    await db.execute(`DROP TABLE IF EXISTS users;`);
    await db.execute(`DROP TABLE IF EXISTS schema_migrations;`);
  },
};
