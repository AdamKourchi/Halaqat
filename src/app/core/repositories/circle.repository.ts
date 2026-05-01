import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Circle } from '../models/circle.model';
import { HomeworkRepository } from './homework.repository';
import { StudentRepository } from './student.repository';
import { UuidHelper } from '../helpers';
import { TeacherRepository } from './teacher.repository';

/**
 * CircleRepository
 *
 * All SQL that touches the `circles` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class CircleRepository extends BaseRepository {
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private uuidHelper = inject(UuidHelper);
  private teacherRepo = inject(TeacherRepository);

  async findAll(): Promise<Circle[]> {
    return this.query<Circle>('SELECT * FROM circles ORDER BY name ASC');
  }

  async findOwnerCircles(): Promise<Circle[]> {
    const owner = await this.teacherRepo.findOwner();
    if (!owner || !owner.id) {
      return [];
    }
    return this.findByTeacherId(owner.id);
  }

  async findById(id: string): Promise<Circle | null> {
    const rows = await this.query<Circle>(
      'SELECT * FROM circles WHERE id = ?',
      [id]
    );
    return rows[0] ?? null;
  }

  /** Return all circles for a specific teacher. */
  async findByTeacherId(teacherId: string): Promise<Circle[]> {
    return this.query<Circle>(
      'SELECT * FROM circles WHERE teacher_id = ? ORDER BY name ASC',
      [teacherId]
    );
  }

  async findAllSharedCircles() {
    //all circles that have Teacher in the teacher table
    return this.query<Circle>(
      'SELECT * FROM circles WHERE teacher_id NOT IN (SELECT id FROM teachers WHERE is_owner = 1)'
    );
  }

  /**
   * Create a circle. Returns the new id.
   */
  async create(
    userId: string,
    name: string,
    type: string,
    creationDate?: string
  ): Promise<number> {
    const id = this.uuidHelper.generate();

    return this.run(
      `INSERT INTO circles (id,teacher_id, name, type, creation_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        name,
        type,
        creationDate ?? new Date().toISOString().split('T')[0],
      ]
    );
  }

  async update(id: string, data: Partial<Circle>): Promise<void> {
    const { clause, values } = this.buildSetClause(data);
    await this.run(`UPDATE circles SET ${clause} WHERE id = ?`, [
      ...values,
      id,
    ]);
  }

async delete(id: string): Promise<void> {
    // 1. Handle the teacher logic
    const circle = await this.findById(id);
    if (circle) {
      const teacher = await this.teacherRepo.findById(circle.teacher_id || '');
      const teacherCircles = await this.findByTeacherId(circle.teacher_id);
      
      if (teacherCircles.length === 1 && teacher && !teacher.is_owner) {
        await this.teacherRepo.delete(teacher.id);
      }
    }

    await this.run('DELETE FROM homeworks WHERE circle_id = ?', [id]);

    await this.run('DELETE FROM students WHERE circle_id = ?', [id]);

    await this.run('DELETE FROM circles WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM circles'
    );
    return rows[0]?.total ?? 0;
  }

  async extractToJSON(id: string) {
    const circle = await this.findById(id);
    const teacher = await this.teacherRepo.findById(circle?.teacher_id || '');
    const students = await this.studentRepo.findByCircleId(id);
    const homeworks = await this.homeworkRepo.findByCircleId(id);
    const data = {
      circle,
      teacher,
      students,
      homeworks,
    };

    return JSON.stringify(data);
  }

  async upsert(circle: Circle): Promise<void> {
    if (!circle.id) return;
    const exists = await this.findById(circle.id);
    if (exists) {
      await this.update(circle.id, circle);
    } else {
      console.log("CREATED",circle);
      
      await this.run(
        `INSERT INTO circles (id, teacher_id, name, type, creation_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          circle.id,
          circle.teacher_id,
          circle.name,
          circle.type,
          circle.creation_date,
        ]
      );
    }
  }
}
