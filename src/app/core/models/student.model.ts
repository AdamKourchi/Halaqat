/** Student model – matches the `students` table schema. */
export interface Student {
  id?: number;
  circle_id: number;
  name: string;
  gender: 'Male' | 'Female' | string;
  enlistment_date?: string;
  parent_name?: string | null;
  parent_contact?: string | null;
  
  // Computed fields (not physical DB columns)
  is_graded_today?: boolean;
  has_ungraded_homework?: boolean;
}
