import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Migration } from './migration.interface';
import { Capacitor } from '@capacitor/core';

/**
 * Migration 003 – Quran Text seed
 *
 * Creates `surahs` and `ayahs` tables, then loads all content
 * from `assets/inserts.sql` (bundled with the app).
 *
 * The inserts.sql file already includes:
 *   - CREATE TABLE IF NOT EXISTS surahs (...)
 *   - INSERT INTO surahs ...  (114 rows)
 *   - CREATE TABLE IF NOT EXISTS ayahs (...)
 *   - CREATE INDEX IF NOT EXISTS idx_surah_ayah ...
 *   - INSERT INTO ayahs ...  (6236 rows)
 *
 * We read the file at runtime and execute it via executSet so the
 * migration runner tracks it as a single atomic migration.
 */
export const migration003: Migration = {
  version: 3,
  description: 'Quran text seed – surahs & ayahs from assets/inserts.sql',

  async up(db: SQLiteDBConnection): Promise<void> {
    // Read the bundled SQL file from the assets folder
    const sqlText = await loadAsset('assets/inserts.sql');

    // Execute the complete script directly.
    // Calling db.execute() with the entire SQL file text is incredibly fast
    // and processes in a single transaction in native SQLite, as opposed to
    // making thousands of bridge calls which causes the app to hang.
    await db.execute(sqlText);

  },

  async down(db: SQLiteDBConnection): Promise<void> {
    await db.execute(`DROP TABLE IF EXISTS ayahs;`);
    await db.execute(`DROP TABLE IF EXISTS surahs;`);
  },
};

// ── helper ─────────────────────────────────────────────────────────────────

async function loadAsset(path: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    // On native, assets are available via a relative URL from the webview root
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load asset: ${path} (${response.status})`);
    }
    return response.text();
  }
  // Fallback for local dev / web testing
  const response = await fetch(`/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${path} (${response.status})`);
  }
  return response.text();
}
