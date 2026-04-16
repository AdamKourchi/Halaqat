import { Injectable, inject } from '@angular/core';
import { BaseRepository } from './base.repository';
import { User } from '../models/user.model';
import { UuidHelper } from '../helpers';

/**
 * UserRepository
 *
 * All SQL that touches the `users` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class UserRepository extends BaseRepository {
  private uuidHelper = inject(UuidHelper);

  async findAll(): Promise<User[]> {
    return this.query<User>('SELECT * FROM users ORDER BY id ASC');
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.query<User>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await this.query<User>(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    return rows[0] ?? null;
  }

  async findByRole(role: string): Promise<User[]> {
    return this.query<User>('SELECT * FROM users WHERE role = ? ORDER BY id ASC', [role]);
  }

  /**
   * Create a new user. Returns the new user's id.
   * @param username  Unique login name
   * @param passwordHash  Pre-hashed password (never store plaintext!)
   * @param role  'ADMIN' | 'TEACHER'
   */
  async create(username: string, passwordHash: string, role: string = 'TEACHER'): Promise<string> {
   //make the user and the teacher with the same data
   const id = this.uuidHelper.generate();
   await this.run(
      `INSERT INTO users (id, username, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [id, username, passwordHash, role]
    );
    const teacherId = this.uuidHelper.generate();
    await this.run(
      `INSERT INTO teachers (id, user_id, name)
       VALUES (?, ?, ?)`,
      [teacherId, id, username]
    );
    return id;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  async updateRole(id: string, role: string): Promise<void> {
    await this.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  }

  async delete(id: string): Promise<void> {
    await this.run('DELETE FROM users WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.query<{ total: number }>('SELECT COUNT(*) AS total FROM users');
    return rows[0]?.total ?? 0;
  }
}
