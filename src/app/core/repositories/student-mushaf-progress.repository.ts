import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';
import { StudentMushafProgress } from '../models/student-mushaf-progress.model';

/** Numeric score mapping: Excellent=4, Very Good=3, Good=2, Needs Work=1 */
export const GRADE_SCORES: Record<string, number> = {
  'Excellent':  4,
  'Very Good':  3,
  'Good':       2,
  'Needs Work': 1,
};

/**
 * StudentMushafProgressRepository
 *
 * All SQL that touches the `student_mushaf_progress` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class StudentMushafProgressRepository extends BaseRepository {

  /** Get all surah progress rows for a student. */
  async findByStudentId(studentId: number): Promise<StudentMushafProgress[]> {
    return this.query<StudentMushafProgress>(
      'SELECT * FROM student_mushaf_progress WHERE student_id = ? ORDER BY surah_number ASC',
      [studentId]
    );
  }

  /** Get progress for a specific student+surah combination. */
  async findByStudentAndSurah(
    studentId: number,
    surahNumber: number
  ): Promise<StudentMushafProgress | null> {
    const rows = await this.query<StudentMushafProgress>(
      `SELECT * FROM student_mushaf_progress
       WHERE student_id = ? AND surah_number = ?`,
      [studentId, surahNumber]
    );
    return rows[0] ?? null;
  }

  /**
   * Upsert a progress record (INSERT or REPLACE).
   * Returns the row id.
   */
  async upsert(progress: Omit<StudentMushafProgress, 'id'>): Promise<number> {
    return this.run(
      `INSERT INTO student_mushaf_progress
         (student_id, surah_number, memorized_percentage, average_score, last_reviewed_date)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(student_id, surah_number) DO UPDATE SET
         memorized_percentage = excluded.memorized_percentage,
         average_score        = excluded.average_score,
         last_reviewed_date   = excluded.last_reviewed_date`,
      [
        progress.student_id,
        progress.surah_number,
        progress.memorized_percentage,
        progress.average_score,
        progress.last_reviewed_date ?? new Date().toISOString().split('T')[0],
      ]
    );
  }

  /**
   * Recalculate and persist a student's average_score for a given surah
   * based on all graded homeworks that touch that surah.
   */
  async recalculateFromHomeworks(studentId: number, surahNumber: number): Promise<void> {
    // Pull all graded homeworks that overlap this surah
    const rows = await this.query<{ grade_mark: string }>(
      `SELECT grade_mark FROM homeworks
       WHERE student_id = ?
         AND graded_date IS NOT NULL
         AND grade_mark IS NOT NULL
         AND (start_surah <= ? AND end_surah >= ?)`,
      [studentId, surahNumber, surahNumber]
    );

    if (rows.length === 0) return;

    const avg =
      rows.reduce((sum, r) => sum + (GRADE_SCORES[r.grade_mark] ?? 0), 0) / rows.length;

    await this.upsert({
      student_id: studentId,
      surah_number: surahNumber,
      memorized_percentage: 0, // caller should set this separately
      average_score: avg,
      last_reviewed_date: new Date().toISOString().split('T')[0],
    });
  }

  async delete(studentId: number, surahNumber: number): Promise<void> {
    await this.run(
      'DELETE FROM student_mushaf_progress WHERE student_id = ? AND surah_number = ?',
      [studentId, surahNumber]
    );
  }
}
