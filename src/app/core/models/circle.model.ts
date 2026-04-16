/** Circle model – matches the `circles` table schema. */
export type CircleType = 'Beginner' | 'Revision' | 'Adults' | string;

export interface Circle {
  id?: string;
  teacher_id: string;
  name: string;
  type: CircleType;
  creation_date?: string;
}
