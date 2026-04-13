import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Student } from '../models/student.model';

/**
 * StudentRepository
 *
 * All SQL that touches the `students` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class StudentRepository extends BaseRepository {

  async findAll(): Promise<Student[]> {
    return this.query<Student>('SELECT * FROM students ORDER BY name ASC');
  }

  async findById(id: number): Promise<Student | null> {
    const rows = await this.query<Student>('SELECT * FROM students WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  /** Return all students enrolled in a given circle, complete with homework tracking fields. */
  async findByCircleId(circleId: number): Promise<Student[]> {
    return this.query<Student>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM homeworks h WHERE h.student_id = s.id AND h.graded_date = date('now', 'localtime')) > 0 as is_graded_today,
        (SELECT COUNT(*) FROM homeworks h WHERE h.student_id = s.id AND h.graded_date IS NULL) > 0 as has_ungraded_homework
       FROM students s 
       WHERE s.circle_id = ? 
       ORDER BY s.name ASC`, 
       [circleId]
    );
  }

  /**
   * Create a student. Returns the new id.
   */
  async create(
    circleId: number,
    name: string,
    gender: string,
    enlistmentDate?: string,
    parentName?: string,
    parentContact?: string
  ): Promise<number> {
    return this.run(
      `INSERT INTO students (circle_id, name, gender, enlistment_date, parent_name, parent_contact)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        circleId,
        name,
        gender,
        enlistmentDate ?? new Date().toISOString().split('T')[0],
        parentName ?? null,
        parentContact ?? null,
      ]
    );
  }

  async update(id: number, data: Partial<Student>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE students SET ${clause} WHERE id = ?`, [...values, id]);
  }

  async delete(id: number): Promise<void> {
    await this.run('DELETE FROM students WHERE id = ?', [id]);
  }

  /** Move a student to a different circle. */
  async transfer(id: number, newCircleId: number): Promise<void> {
    await this.run('UPDATE students SET circle_id = ? WHERE id = ?', [newCircleId, id]);
  }

  async countByCircle(circleId: number): Promise<number> {
    const rows = await this.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM students WHERE circle_id = ?', [circleId]
    );
    return rows[0]?.total ?? 0;
  }
}
