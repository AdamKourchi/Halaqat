/** Grade marks used in the `homeworks` table. */
export type GradeMark = 'Excellent' | 'Very Good' | 'Good' | 'Needs Work' |'Absent'| string;

/** Homework model – matches the `homeworks` table schema. */
export interface Homework {
  id?: number;
  student_id: number;
  circle_id?: number | null;
  date_assigned?: string;
  start_surah: number;
  start_ayah: number;
  end_surah: number;
  end_ayah: number;
  mistakes_count?: number;
  grade_mark?: GradeMark | null;
  remark?: string | null;
  graded_date?: string | null;
}
