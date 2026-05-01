/** A single row from the `quran_divisions` table. */
export interface QuranDivision {
  hizb_number: number;          // 1–60
  thumun_number: number;        // 1–8 within the Hizb
  start_surah_id: number;
  start_ayah_number: number;
  end_surah_id: number;
  end_ayah_number: number;
}

/**
 * Number of Thumuns in a homework assignment.
 *
 * 8 = full Hizb
 * 4 = Half (Nisf)
 * 2 = Quarter (Rub')
 * 1 = Eighth (Thumun)
 */
export type ThumunCount = 1 | 2 | 4 | 8;

/** Human-readable label for each division size (Arabic). */
export const THUMUN_COUNT_LABELS: Record<ThumunCount, string> = {
  8: 'الحزب كاملاً',
  4: 'نصف الحزب',
  2: 'ربع الحزب',
  1: 'ثُمن',
};
