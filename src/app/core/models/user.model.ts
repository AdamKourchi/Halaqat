/**
 * User model – matches the `users` table schema.
 */
export interface User {
  id?: number;
  username: string;
  password_hash: string;
  role: 'ADMIN' | 'TEACHER' | string;
  created_at?: string;
}
