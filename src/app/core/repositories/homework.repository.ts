import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Homework, GradeMark } from '../models/homework.model';
import { UuidHelper } from '../helpers';

/**
 * HomeworkRepository
 *
 * All SQL that touches the `homeworks` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class HomeworkRepository extends BaseRepository {
  private uuidHelper = inject(UuidHelper);

  async findById(id: string): Promise<Homework | null> {
    const rows = await this.query<Homework>('SELECT * FROM homeworks WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  /** All homeworks for a single student, newest first. */
  async findByStudentId(studentId: string): Promise<Homework[]> {
    return this.query<Homework>(
      'SELECT * FROM homeworks WHERE student_id = ? ORDER BY graded_date DESC',
      [studentId]
    );
  }

  /** All homeworks for a circle on a given date (for class summaries). */
  async findByCircleAndDate(circleId: string, date: string): Promise<Homework[]> {
    return this.query<Homework>(
      `SELECT * FROM homeworks WHERE circle_id = ? AND date_assigned = ?
       ORDER BY student_id ASC`,
      [circleId, date]
    );
  }

  /**All Homeworks for a circle */
  async findByCircleId(circleId: string): Promise<Homework[]> {
    return this.query<Homework>(
      `SELECT * FROM homeworks WHERE circle_id = ? ORDER BY date_assigned DESC`,
      [circleId]
    );
  }

  /** Ungraded homeworks for a student. */
  async findUngraded(studentId: string): Promise<Homework[]> {
    return this.query<Homework>(
      `SELECT * FROM homeworks WHERE student_id = ? AND graded_date IS NULL
       ORDER BY date_assigned DESC`,
      [studentId]
    );
  }

  /**
   * Create a homework record. Returns the new id.
   */
  async create(hw: Omit<Homework, 'id'>): Promise<string> {
    const id = this.uuidHelper.generate();
    await this.run(
      `INSERT INTO homeworks
         (id, student_id, circle_id, date_assigned,
          start_surah, start_ayah, end_surah, end_ayah,
          mistakes_count, grade_mark, remark, graded_date, is_pre_memorized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        hw.student_id,
        hw.circle_id ?? null,
        hw.date_assigned ?? new Date().toISOString().split('T')[0],
        hw.start_surah,
        hw.start_ayah,
        hw.end_surah,
        hw.end_ayah,
        hw.mistakes_count ?? 0,
        hw.grade_mark ?? null,
        hw.remark ?? null,
        null,
        hw.is_pre_memorized ?? 0,
      ]
    );
    return id;
  }

  /**
   * Grade an existing homework record.
   */
  async grade(
    id: string,
    gradeMark: GradeMark,
    mistakesCount: number,
    remark?: string
  ): Promise<void> {
    await this.run(
      `UPDATE homeworks
       SET grade_mark = ?, mistakes_count = ?, remark = ?, graded_date = date('now')
       WHERE id = ?`,
      [gradeMark, mistakesCount, remark ?? null, id]
    );
  }

  async update(id: string, data: Partial<Homework>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE homeworks SET ${clause} WHERE id = ?`, [...values, id]);
  }

  async delete(id: string): Promise<void> {
    await this.run('DELETE FROM homeworks WHERE id = ?', [id]);
  }

  async upsert(hw: Homework): Promise<void> {
    if (!hw.id) return;
    const exists = await this.findById(hw.id);
    if (exists) {
      await this.update(hw.id, hw);
    } else {
      await this.run(
        `INSERT INTO homeworks
           (id, student_id, circle_id, date_assigned,
            start_surah, start_ayah, end_surah, end_ayah,
            mistakes_count, grade_mark, remark, graded_date, is_pre_memorized)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hw.id,
          hw.student_id,
          hw.circle_id ?? null,
          hw.date_assigned,
          hw.start_surah,
          hw.start_ayah,
          hw.end_surah,
          hw.end_ayah,
          hw.mistakes_count ?? 0,
          hw.grade_mark ?? null,
          hw.remark ?? null,
          hw.graded_date ?? null,
          hw.is_pre_memorized ?? 0,
        ]
      );
    }
  }
}
