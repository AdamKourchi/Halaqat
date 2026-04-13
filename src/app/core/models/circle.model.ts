/** Circle model – matches the `circles` table schema. */
export type CircleType = 'Beginner' | 'Revision' | 'Adults' | string;

export interface Circle {
  id?: number;
  teacher_id: number;
  name: string;
  type: CircleType;
  creation_date?: string;
}
