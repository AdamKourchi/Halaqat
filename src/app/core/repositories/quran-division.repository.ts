import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';
import { QuranDivision, ThumunCount } from '../models/quran-division.model';

/**
 * QuranDivisionRepository
 *
 * Provides two bidirectional conversion helpers:
 *
 *  toAyahRange   – Hizb + Thumun selection  →  {start_surah, start_ayah, end_surah, end_ayah}
 *  fromAyahRange – Surah:Ayah range          →  human-readable Hizb/Thumun label
 *
 * Reads from the `quran_divisions` table (seeded at app init).
 */
@Injectable({ providedIn: 'root' })
export class QuranDivisionRepository extends BaseRepository {

  // ── Raw access ──────────────────────────────────────────────────────────

  /** Fetch a single Thumun row. */
  async getThumun(hizbNumber: number, thumunNumber: number): Promise<QuranDivision | null> {
    const rows = await this.query<QuranDivision>(
      'SELECT * FROM quran_divisions WHERE hizb_number = ? AND thumun_number = ?',
      [hizbNumber, thumunNumber],
    );
    return rows[0] ?? null;
  }

  /** Fetch all 8 Thumuns for a given Hizb, ordered. */
  async getHizb(hizbNumber: number): Promise<QuranDivision[]> {
    return this.query<QuranDivision>(
      'SELECT * FROM quran_divisions WHERE hizb_number = ? ORDER BY thumun_number ASC',
      [hizbNumber],
    );
  }

  // ── Hizb → Ayah range ───────────────────────────────────────────────────

  /**
   * Convert a Hizb + subdivision selection to a concrete Surah:Ayah range.
   *
   * @param hizbNumber   1–60
   * @param startThumun  Which Thumun inside the Hizb to start from (1–8)
   * @param thumunCount  How many consecutive Thumuns (1 | 2 | 4 | 8)
   *
   * Returns null if the DB rows are missing.
   */
  async toAyahRange(
    hizbNumber: number,
    startThumun: number,
    thumunCount: ThumunCount,
  ): Promise<{ start_surah: number; start_ayah: number; end_surah: number; end_ayah: number } | null> {
    const endThumun = startThumun + thumunCount - 1;

    const startRow = await this.getThumun(hizbNumber, startThumun);
    const endRow   = await this.getThumun(hizbNumber, endThumun);

    if (!startRow || !endRow) return null;

    return {
      start_surah: startRow.start_surah_id,
      start_ayah:  startRow.start_ayah_number,
      end_surah:   endRow.end_surah_id,
      end_ayah:    endRow.end_ayah_number,
    };
  }

  // ── Ayah range → Hizb label ─────────────────────────────────────────────

  /**
   * Translate a Surah:Ayah range (as stored in a Homework row) to its
   * Hizb/Thumun label.  Falls back gracefully if the range doesn't align
   * cleanly to Thumun boundaries.
   *
   * Examples of returned strings:
   *  "الحزب 1 كاملاً"
   *  "الحزب 1 — النصف الأول"
   *  "الحزب 1 — الربع الثاني"
   *  "الحزب 1 — الثُمن 3"
   *  "الحزب 1 — الثُمن 2 إلى 5"  (non-standard range)
   *  null  (no match found at all)
   */
  async fromAyahRange(
    startSurah: number,
    startAyah:  number,
    endSurah:   number,
    endAyah:    number,
  ): Promise<string | null> {
    // Find the Thumun that starts at this verse
    const startRows = await this.query<QuranDivision>(
      `SELECT * FROM quran_divisions
       WHERE start_surah_id = ? AND start_ayah_number = ?`,
      [startSurah, startAyah],
    );
    if (startRows.length === 0) return null;

    // Find the Thumun that ends at this verse
    const endRows = await this.query<QuranDivision>(
      `SELECT * FROM quran_divisions
       WHERE end_surah_id = ? AND end_ayah_number = ?`,
      [endSurah, endAyah],
    );
    if (endRows.length === 0) return null;

    // Match pairs in the same Hizb
    for (const s of startRows) {
      for (const e of endRows) {
        if (s.hizb_number !== e.hizb_number) continue;

        const hizb  = s.hizb_number;
        const start = s.thumun_number;
        const end   = e.thumun_number;
        const count = end - start + 1;

        // Full Hizb
        if (start === 1 && count === 8) {
          return `الحزب ${hizb} كاملاً`;
        }
        // Standard halves  (1–4 | 5–8)
        if (count === 4) {
          const halfNum = start === 1 ? 'الأول' : 'الثاني';
          return `الحزب ${hizb} — النصف ${halfNum}`;
        }
        // Standard quarters (1–2 | 3–4 | 5–6 | 7–8)
        if (count === 2 && (start - 1) % 2 === 0) {
          const quarterLabels: Record<number, string> = { 1: 'الأول', 3: 'الثاني', 5: 'الثالث', 7: 'الرابع' };
          const quarterLabel = quarterLabels[start] ?? `${Math.ceil(start / 2)}`;
          return `الحزب ${hizb} — الربع ${quarterLabel}`;
        }
        // Single Thumun
        if (count === 1) {
          return `الحزب ${hizb} — الثُمن ${start}`;
        }
        // Non-standard range — still give useful context
        return `الحزب ${hizb} — الثُمن ${start} إلى ${end}`;
      }
    }

    return null; // ranges span multiple Hizbs or no alignment found
  }

  // ── Utility: valid starting Thumuns ─────────────────────────────────────

  /**
   * Return the valid starting Thumun numbers for a given count.
   *
   *  count=8  → [1]           (only one full Hizb)
   *  count=4  → [1, 5]        (two halves)
   *  count=2  → [1, 3, 5, 7]  (four quarters)
   *  count=1  → [1..8]        (eight eighths)
   */
  static validStartThumuns(count: ThumunCount): number[] {
    const starts: number[] = [];
    for (let t = 1; t <= 8; t += count) {
      starts.push(t);
    }
    return starts;
  }

  /**
   * Human-readable label for a given startThumun + count pair.
   *
   * Examples:
   *  (1, 4)  → "النصف الأول"
   *  (5, 4)  → "النصف الثاني"
   *  (3, 2)  → "الربع الثاني"
   *  (6, 1)  → "الثُمن 6"
   */
  static subdivisionLabel(startThumun: number, count: ThumunCount): string {
    if (count === 8) return 'الحزب كاملاً';

    if (count === 4) {
      return startThumun === 1 ? 'النصف الأول' : 'النصف الثاني';
    }

    if (count === 2) {
      const labels: Record<number, string> = {
        1: 'الربع الأول',
        3: 'الربع الثاني',
        5: 'الربع الثالث',
        7: 'الربع الرابع',
      };
      return labels[startThumun] ?? `ربع (ثُمن ${startThumun}–${startThumun + 1})`;
    }

    // count === 1
    return `الثُمن ${startThumun}`;
  }

  async getThumunCountBetween(
    startSurah: number, startAyah: number,
    endSurah: number, endAyah: number
  ): Promise<number> {
    // Find the starting Thumun row
    const startRows = await this.query<QuranDivision>(
      `SELECT * FROM quran_divisions
       WHERE start_surah_id = ? AND start_ayah_number = ?`,
      [startSurah, startAyah],
    );
    if (startRows.length === 0) return 0;

    // Find the ending Thumun row
    const endRows = await this.query<QuranDivision>(
      `SELECT * FROM quran_divisions
       WHERE end_surah_id = ? AND end_ayah_number = ?`,
      [endSurah, endAyah],
    );
    if (endRows.length === 0) return 0;

    const start = startRows[0];
    const end = endRows[0];

    // Calculate total thumuns using the base-8 formula
    const count = ((end.hizb_number - start.hizb_number) * 8) 
                  + (end.thumun_number - start.thumun_number) 
                  + 1;

    // Prevent negative numbers in case of reversed ayah inputs
    return count > 0 ? count : 0;
  }
}
