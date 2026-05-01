import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Migration } from './migration.interface';

/**
 * Migration 004 – Mushaf Progress Table Redesign
 *
 * Drops the dormant per-surah progress table and replaces it with a
 * Thumun-keyed aggregation table.  Also adds `is_pre_memorized` to
 * `homeworks` so onboarding records are distinguishable.
 */
export const migration004: Migration = {
  version: 4,
  description: 'Redesign student_mushaf_progress as Thumun-keyed aggregation table',

  async up(db: SQLiteDBConnection): Promise<void> {
    // ── Drop old dormant schema ────────────────────────────────────────────
    await db.execute(`DROP TABLE IF EXISTS student_mushaf_progress;`);

    // ── New Thumun-keyed progress table ───────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS student_mushaf_progress (
        id               TEXT    PRIMARY KEY,
        student_id       TEXT    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        hizb_number      INTEGER NOT NULL,   -- 1–60
        thumun_number    INTEGER NOT NULL,   -- 1–8 within Hizb
        review_count     INTEGER NOT NULL DEFAULT 0,
        average_score    REAL    NOT NULL DEFAULT 0.0,  -- 0.0–4.0
        last_graded_date TEXT,               -- ISO date, updated on each grade
        is_pre_memorized INTEGER NOT NULL DEFAULT 0,    -- 1 = onboarded before Halaqat
        UNIQUE (student_id, hizb_number, thumun_number)
      );
    `);

    // ── Indexes ───────────────────────────────────────────────────────────
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_progress_student
       ON student_mushaf_progress(student_id);`
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_progress_hizb
       ON student_mushaf_progress(student_id, hizb_number);`
    );

    // ── Add is_pre_memorized column to homeworks ──────────────────────────
    // SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we guard it.
    try {
      await db.execute(`
        ALTER TABLE homeworks ADD COLUMN is_pre_memorized INTEGER NOT NULL DEFAULTa 0;
      `);
    } catch {
      // Column already exists (hot-reload / re-run scenario) — safe to ignore
    }
    },

  async down(db: SQLiteDBConnection): Promise<void> {
    await db.execute(`DROP TABLE IF EXISTS student_mushaf_progress;`);
    // Note: SQLite cannot drop columns, so is_pre_memorized stays on homeworks
    // Re-create basic table so migration 002 remains consistent on full rollback
    await db.execute(`
      CREATE TABLE IF NOT EXISTS student_mushaf_progress (
        student_id   INTEGER,
        surah_id     INTEGER,
        ayah_number  INTEGER,
        is_memorized BOOLEAN DEFAULT 1,
        PRIMARY KEY (student_id, surah_id, ayah_number)
      );
    `);
  },
};



