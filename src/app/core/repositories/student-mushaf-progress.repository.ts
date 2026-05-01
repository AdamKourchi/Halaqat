import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { StudentMushafProgress } from '../models/student-mushaf-progress.model';
import { UuidHelper } from '../helpers';

/** Numeric score mapping: Excellent=4, Very Good=3, Good=2, Needs Work=1, Absent=0 */
export const GRADE_SCORES: Record<string, number> = {
  'Excellent':  4,
  'Very Good':  3,
  'Good':       2,
  'Needs Work': 1,
  'Absent':     0,
};

/**
 * StudentMushafProgressRepository
 *
 * All SQL that touches `student_mushaf_progress` lives here.
 * The table is keyed by (student_id, hizb_number, thumun_number).
 */
@Injectable({ providedIn: 'root' })
export class StudentMushafProgressRepository extends BaseRepository {
  private uuidHelper = inject(UuidHelper);

  // ── Read ────────────────────────────────────────────────────────────────

  /** All progress rows for a student, ordered by hizb then thumun. */
  async findByStudentId(studentId: string): Promise<StudentMushafProgress[]> {
    return this.query<StudentMushafProgress>(
      `SELECT * FROM student_mushaf_progress
       WHERE student_id = ?
       ORDER BY hizb_number ASC, thumun_number ASC`,
      [studentId]
    );
  }

  /** A single Thumun row, or null if not yet tracked. */
  async findThumun(
    studentId: string,
    hizbNumber: number,
    thumunNumber: number
  ): Promise<StudentMushafProgress | null> {
    const rows = await this.query<StudentMushafProgress>(
      `SELECT * FROM student_mushaf_progress
       WHERE student_id = ? AND hizb_number = ? AND thumun_number = ?`,
      [studentId, hizbNumber, thumunNumber]
    );
    return rows[0] ?? null;
  }

  // ── Write ───────────────────────────────────────────────────────────────

  /**
   * Recalculate and persist a single Thumun's progress record by aggregating
   * all graded homeworks whose ayah range overlaps this Thumun.
   *
   * This is the primary write path — call it after every grading event for
   * each Thumun that the homework touches.
   *
   * @param studentId       Student UUID
   * @param hizbNumber      1–60
   * @param thumunNumber    1–8
   * @param isPreMemorized  Pass 1 when writing onboarding (pre-Halaqat) records
   */
  async recalculateFromHomeworks(
    studentId: string,
    hizbNumber: number,
    thumunNumber: number,
    isPreMemorized: 0 | 1 = 0
  ): Promise<void> {
    // 1. Look up this Thumun's ayah boundaries
    const divRows = await this.query<{
      start_surah_id: number;
      start_ayah_number: number;
      end_surah_id: number;
      end_ayah_number: number;
    }>(
      `SELECT start_surah_id, start_ayah_number, end_surah_id, end_ayah_number
       FROM quran_divisions
       WHERE hizb_number = ? AND thumun_number = ?`,
      [hizbNumber, thumunNumber]
    );

    if (divRows.length === 0) return; // No division data — skip silently

    const div = divRows[0];

    // 2. Find all graded homeworks that overlap this Thumun's range.
    //    Overlap condition: hw.start <= thumun.end AND hw.end >= thumun.start
    //    Encoded pair-wise as (start_surah, start_ayah) and (end_surah, end_ayah).
    const hwRows = await this.query<{ grade_mark: string; is_pre_memorized: number; graded_date: string }>(
      `SELECT grade_mark, is_pre_memorized, graded_date
       FROM homeworks
       WHERE student_id = ?
         AND graded_date IS NOT NULL
         AND grade_mark IS NOT NULL
         AND grade_mark != 'Absent'
         AND grade_mark != 'Repeat'
         AND (
           -- homework starts before or at the Thumun end
           (start_surah < ? OR (start_surah = ? AND start_ayah <= ?))
           AND
           -- homework ends on or after the Thumun start
           (end_surah > ? OR (end_surah = ? AND end_ayah >= ?))
         )`,
      [
        studentId,
        div.end_surah_id, div.end_surah_id, div.end_ayah_number,
        div.start_surah_id, div.start_surah_id, div.start_ayah_number,
      ]
    );

    const existing = await this.findThumun(studentId, hizbNumber, thumunNumber);
    const preMemFlag = existing?.is_pre_memorized ? 1 : isPreMemorized;

    if (hwRows.length === 0) {
      if (preMemFlag === 1) {
        // Reset to pre-memorized defaults
        await this.run(
           `UPDATE student_mushaf_progress 
            SET review_count = 0, average_score = 0.0 
            WHERE student_id = ? AND hizb_number = ? AND thumun_number = ?`,
            [studentId, hizbNumber, thumunNumber]
        );
      } else {
        // Delete completely since no homeworks cover it anymore
        await this.deleteThumun(studentId, hizbNumber, thumunNumber);
      }
      return;
    }

    // 3. Compute aggregates
    const totalScore = hwRows.reduce((sum, r) => sum + (GRADE_SCORES[r.grade_mark] ?? 0), 0);
    const avgScore   = totalScore / hwRows.length;
    
    // Sort dates to find the latest
    const dates = hwRows.map(r => r.graded_date).filter(Boolean).sort();
    const latestDate = dates[dates.length - 1] || new Date().toISOString().split('T')[0];

    // 4. Upsert the progress record
    const id = existing?.id || this.uuidHelper.generate();
    await this.run(
      `INSERT INTO student_mushaf_progress
         (id, student_id, hizb_number, thumun_number,
          review_count, average_score, last_graded_date, is_pre_memorized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, hizb_number, thumun_number) DO UPDATE SET
         review_count     = ?,
         average_score    = ?,
         last_graded_date = ?,
         is_pre_memorized = CASE
           WHEN excluded.is_pre_memorized = 0 THEN 0
           ELSE is_pre_memorized
         END`,
      [
        id,
        studentId,
        hizbNumber,
        thumunNumber,
        hwRows.length,
        avgScore,
        latestDate,
        preMemFlag,
        hwRows.length,
        avgScore,
        latestDate,
      ]
    );
  }

  /**
   * Bulk-insert pre-memorized Thumun records for a student onboarding.
   * Each entry describes one Thumun that the student already knew before joining.
   */
  async bulkInsertPreMemorized(
    studentId: string,
    thumuns: Array<{ hizb_number: number; thumun_number: number }>
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    for (const t of thumuns) {
      const id = this.uuidHelper.generate();
      await this.run(
        `INSERT INTO student_mushaf_progress
           (id, student_id, hizb_number, thumun_number,
            review_count, average_score, last_graded_date, is_pre_memorized)
         VALUES (?, ?, ?, ?, 0, 0.0, ?, 1)
         ON CONFLICT(student_id, hizb_number, thumun_number) DO NOTHING`,
        [id, studentId, t.hizb_number, t.thumun_number, today]
      );
    }
  }

  /** Delete progress for a specific Thumun. */
  async deleteThumun(
    studentId: string,
    hizbNumber: number,
    thumunNumber: number
  ): Promise<void> {
    await this.run(
      `DELETE FROM student_mushaf_progress
       WHERE student_id = ? AND hizb_number = ? AND thumun_number = ?`,
      [studentId, hizbNumber, thumunNumber]
    );
  }

  /** Delete ALL progress rows for a student (e.g. on student delete). */
  async deleteAllForStudent(studentId: string): Promise<void> {
    await this.run(
      `DELETE FROM student_mushaf_progress WHERE student_id = ?`,
      [studentId]
    );
  }
}
