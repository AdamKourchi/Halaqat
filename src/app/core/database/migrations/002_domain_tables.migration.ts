import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Migration } from './migration.interface';

/**
 * Migration 002 – App domain tables
 *
 * Creates: teachers, circles, students, homeworks, student_mushaf_progress
 */
export const migration002: Migration = {
  version: 2,
  description: 'Domain tables – teachers, circles, students, homeworks, progress',

  async up(db: SQLiteDBConnection): Promise<void> {
    // ── teachers ───────────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS teachers (
        id           TEXT PRIMARY KEY,
        name         TEXT    NOT NULL,
        is_owner     BOOLEAN NOT NULL DEFAULT 0,
        contact_info TEXT
      );
    `);

    // ── circles ────────────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS circles (
        id            TEXT PRIMARY KEY,
        teacher_id    TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name          TEXT    NOT NULL,
        type          TEXT    NOT NULL,
        creation_date TEXT    NOT NULL DEFAULT (date('now'))
      );
    `);

    // ── students ───────────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id              TEXT PRIMARY KEY,
        circle_id       TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
        name            TEXT    NOT NULL,
        gender          TEXT    NOT NULL,
        enlistment_date TEXT    NOT NULL DEFAULT (date('now')),
        parent_name     TEXT,
        parent_contact  TEXT
      );
    `);

    // ── homeworks ──────────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS homeworks (
        id             TEXT PRIMARY KEY,
        student_id     TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        circle_id      TEXT          REFERENCES circles(id)  ON DELETE SET NULL,
        date_assigned  TEXT    NOT NULL DEFAULT (date('now')),
        start_surah    INTEGER NOT NULL,
        start_ayah     INTEGER NOT NULL,
        end_surah      INTEGER NOT NULL,
        end_ayah       INTEGER NOT NULL,
        mistakes_count INTEGER NOT NULL DEFAULT 0,
        grade_mark     TEXT,
        remark         TEXT,
        graded_date    TEXT
      );
    `);

    // ── student_mushaf_progress ────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS student_mushaf_progress (
        id                  TEXT PRIMARY KEY,
        student_id          TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        surah_number        INTEGER NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
        memorized_percentage REAL    NOT NULL DEFAULT 0.0,
        average_score       REAL    NOT NULL DEFAULT 0.0,
        last_reviewed_date  TEXT,
        UNIQUE(student_id, surah_number)
      );
    `);

    // ── indexes for common look-ups ────────────────────────────────────────
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_circles_teacher   ON circles(teacher_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_students_circle   ON students(circle_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_homeworks_student ON homeworks(student_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_homeworks_circle  ON homeworks(circle_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_progress_student  ON student_mushaf_progress(student_id);`);
  },

  async down(db: SQLiteDBConnection): Promise<void> {
    await db.execute(`DROP TABLE IF EXISTS student_mushaf_progress;`);
    await db.execute(`DROP TABLE IF EXISTS homeworks;`);
    await db.execute(`DROP TABLE IF EXISTS students;`);
    await db.execute(`DROP TABLE IF EXISTS circles;`);
    await db.execute(`DROP TABLE IF EXISTS teachers;`);
  },
};
