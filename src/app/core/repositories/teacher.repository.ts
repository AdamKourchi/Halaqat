import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Teacher } from '../models/teacher.model';

/**
 * TeacherRepository
 *
 * All SQL that touches the `teachers` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class TeacherRepository extends BaseRepository {

  async findAll(): Promise<Teacher[]> {
    return this.query<Teacher>('SELECT * FROM teachers ORDER BY name ASC');
  }

  async findById(id: number): Promise<Teacher | null> {
    const rows = await this.query<Teacher>('SELECT * FROM teachers WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async findByUserId(userId: number): Promise<Teacher | null> {
    const rows = await this.query<Teacher>(
      'SELECT * FROM teachers WHERE user_id = ?', [userId]
    );
    return rows[0] ?? null;
  }

  /**
   * Create a teacher. Returns the new id.
   * @param name Display name of the teacher
   * @param contactInfo Optional contact details
   * @param userId Optional FK to users.id (when the teacher has a login)
   */
  async create(name: string, contactInfo?: string, userId?: number): Promise<number> {
    return this.run(
      `INSERT INTO teachers (name, contact_info, user_id) VALUES (?, ?, ?)`,
      [name, contactInfo ?? null, userId ?? null]
    );
  }

  async update(id: number, data: Partial<Teacher>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE teachers SET ${clause} WHERE id = ?`, [...values, id]);
  }

  async delete(id: number): Promise<void> {
    await this.run('DELETE FROM teachers WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.query<{ total: number }>('SELECT COUNT(*) AS total FROM teachers');
    return rows[0]?.total ?? 0;
  }
}
