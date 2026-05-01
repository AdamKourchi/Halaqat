/** Grade marks used in the `homeworks` table. */
export type GradeMark = 'Excellent' | 'Very Good' | 'Good' | 'Needs Work' | 'Absent' | 'Repeat';

/** Homework model – matches the `homeworks` table schema. */
export interface Homework {
  id?: string;
  student_id: string;
  circle_id?: string | null;
  date_assigned?: string;
  start_surah: number;
  start_ayah: number;
  end_surah: number;
  end_ayah: number;
  mistakes_count?: number;
  grade_mark?: GradeMark | null;
  remark?: string | null;
  graded_date?: string | null;
  is_pre_memorized?: number;    // 0 = standard, 1 = pre-Halaqat onboarding record
}
