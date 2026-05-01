/** A single row from `student_mushaf_progress` – Thumun-keyed. */
export interface StudentMushafProgress {
  id?: string;
  student_id: string;
  hizb_number: number;          // 1–60
  thumun_number: number;        // 1–8 within the Hizb
  review_count: number;
  average_score: number;        // 0.0–4.0
  last_graded_date?: string | null;
  is_pre_memorized: number;     // 0 | 1
}

// ── View Models (UI layer only) ──────────────────────────────────────────────

/** Colour-coded status for review-decay logic. */
export type DecayStatus = 'fresh' | 'aging' | 'due';

/** Enriched per-Thumun view-model used by the Mushaf Visualizer. */
export interface ThumunProgressVM {
  hizb_number: number;
  thumun_number: number;
  average_score: number;
  review_count: number;
  last_graded_date: string | null;
  is_pre_memorized: boolean;
  decay_status: DecayStatus;
}

/** Aggregated per-Hizb view-model (groups 8 Thumuns). */
export interface HizbProgressVM {
  hizb_number: number;
  /** How many of the 8 Thumuns have at least one progress record. */
  memorized_count: number;
  /** memorized_count / 8 × 100 */
  completion_pct: number;
  /** Mean average_score across all memorized Thumuns. */
  avg_score: number;
  /** Overall decay status for the Hizb (worst-case of its Thumuns). */
  decay_status: DecayStatus;
  thumuns: ThumunProgressVM[];
}
