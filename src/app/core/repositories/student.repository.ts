import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Student } from '../models/student.model';
import { UuidHelper } from '../helpers';

/**
 * StudentRepository
 *
 * All SQL that touches the `students` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class StudentRepository extends BaseRepository {
  private uuidHelper = inject(UuidHelper);

  async findAll(): Promise<Student[]> {
    return this.query<Student>('SELECT * FROM students ORDER BY name ASC');
  }

  async findById(id: string): Promise<Student | null> {
    const rows = await this.query<Student>('SELECT * FROM students WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  /** Return all students enrolled in a given circle, complete with homework tracking fields. */
  async findByCircleId(circleId: string): Promise<Student[]> {
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
    circleId: string,
    name: string,
    gender: string,
    parentName?: string,
    parentContact?: string
  ): Promise<string> {
    const id = this.uuidHelper.generate();
    await this.run(
      `INSERT INTO students (id, circle_id, name, gender, enlistment_date, parent_name, parent_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        circleId,
        name,
        gender,
        new Date().toISOString().split('T')[0],
        parentName ?? null,
        parentContact ?? null,
      ]
    );
    return id;
  }

  async update(id: string, data: Partial<Student>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE students SET ${clause} WHERE id = ?`, [...values, id]);
  }

  async delete(id: string): Promise<void> {
    await this.run('DELETE FROM students WHERE id = ?', [id]);
  }

  /** Move a student to a different circle. */
  async transfer(id: string, newCircleId: string): Promise<void> {
    await this.run('UPDATE students SET circle_id = ? WHERE id = ?', [newCircleId, id]);
  }

  async countByCircle(circleId: string): Promise<number> {
    const rows = await this.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM students WHERE circle_id = ?', [circleId]
    );
    return rows[0]?.total ?? 0;
  }

  async upsert(student: Student): Promise<void> {
    if (!student.id) return;
    const exists = await this.findById(student.id);
    if (exists) {
      // Exclude relational runtime properties not in table like 'is_graded_today', etc.
      const { ...dbData } = student as any;
      delete dbData.is_graded_today;
      delete dbData.has_ungraded_homework;
      await this.update(student.id, dbData);
    } else {
      await this.run(
        `INSERT INTO students (id, circle_id, name, gender, enlistment_date, parent_name, parent_contact)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          student.id,
          student.circle_id,
          student.name,
          student.gender,
          student.enlistment_date,
          student.parent_name ?? null,
          student.parent_contact ?? null,
        ]
      );
    }
  }
}
