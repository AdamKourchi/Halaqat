import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Teacher } from '../models/teacher.model';
import { UuidHelper } from '../helpers';

/**
 * TeacherRepository
 *
 * All SQL that touches the `teachers` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class TeacherRepository extends BaseRepository {
  private uuidHelper = inject(UuidHelper);

  async findAll(): Promise<Teacher[]> {
    return this.query<Teacher>('SELECT * FROM teachers ORDER BY name ASC');
  }

  async findById(id: string): Promise<Teacher | null> {
    const rows = await this.query<Teacher>('SELECT * FROM teachers WHERE id = ?', [id]);
    return rows[0] ?? null;
  }
async findOwner(): Promise<Teacher | null> {
  const rows = await this.query<Teacher>('SELECT * FROM teachers WHERE is_owner = true');
  return rows[0] ?? null;
}

  /**
   * Create a teacher. Returns the new id.
   * @param name Display name of the teacher
   * @param contactInfo Optional contact details
   * @param userId Optional FK to users.id (when the teacher has a login)
   */
  async create(id: string | null,name: string, contactInfo: string | null,is_owner : boolean = false): Promise<string> {
    if(!id){
      id = this.uuidHelper.generate();
    }
    await this.run(
      `INSERT INTO teachers (id, name, contact_info,is_owner) VALUES (?, ?, ?, ?)`,
      [id, name, contactInfo ?? null,is_owner]
    );
    return id;
  }

  async update(id: string, data: Partial<Teacher>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE teachers SET ${clause} WHERE id = ?`, [...values, id]);
  }

  async delete(id: string): Promise<void> {
    await this.run('DELETE FROM teachers WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.query<{ total: number }>('SELECT COUNT(*) AS total FROM teachers');
    return rows[0]?.total ?? 0;
  }

  async upsert(teacher: Teacher): Promise<void> { 
    teacher.is_owner = false;
   
    const existing = await this.findById(teacher.id);
    if (existing) {
      await this.update(teacher.id, teacher);
    } else {
      await this.create(teacher.id,teacher.name, teacher.contact_info, false);
    }

    
  }
}
