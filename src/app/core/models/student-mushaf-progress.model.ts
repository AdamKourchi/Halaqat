/** StudentMushafProgress model – matches the `student_mushaf_progress` table. */
export interface StudentMushafProgress {
  id?: number;
  student_id: number;
  surah_number: number;           // 1–114
  memorized_percentage: number;   // 0.0–100.0
  average_score: number;          // 0.0–4.0 (Excellent=4, Very Good=3, Good=2, Needs Work=1)
  last_reviewed_date?: string | null;
}
