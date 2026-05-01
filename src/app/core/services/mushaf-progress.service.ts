import { Injectable, inject } from '@angular/core';
import { HomeworkRepository } from '../repositories/homework.repository';
import { StudentMushafProgressRepository } from '../repositories/student-mushaf-progress.repository';
import {
  DecayStatus,
  HizbProgressVM,
  ThumunProgressVM,
} from '../models/student-mushaf-progress.model';
import { BaseRepository } from '../repositories/base.repository';

// ── Decay thresholds ──────────────────────────────────────────────────────────
const DECAY_FRESH_DAYS = 14;
const DECAY_AGING_DAYS = 30;

/** Total Thumuns in a Hizb. */
const THUMUNS_PER_HIZB = 8;

/**
 * MushafProgressService
 *
 * Sits between the grading UI and the progress table.
 *
 * Key responsibilities:
 *  1. After a homework is graded, detect which Thumuns it overlaps and
 *     update their aggregated progress records.
 *  2. Build the HizbProgressVM[] view-model for the Mushaf Visualizer.
 *  3. Handle bulk pre-memorised onboarding.
 *  4. Compute review-decay status from the last_graded_date.
 */
@Injectable({ providedIn: 'root' })
export class MushafProgressService {
  private homeworkRepo = inject(HomeworkRepository);
  private progressRepo = inject(StudentMushafProgressRepository);
  private divisionRepo = inject(_QuranDivisionsHelper);

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Must be called after every successful `homeworkRepo.grade()` call.
   * Determines which Thumuns the homework spans and recalculates each one.
   */
  async updateProgressAfterGrading(homeworkId: string): Promise<void> {
    const hw = await this.homeworkRepo.findById(homeworkId);
    if (!hw || !hw.graded_date || !hw.student_id) return;
    if (hw.grade_mark === 'Absent' || hw.grade_mark === 'Repeat') return; // Absent and Repeat doesn't count as memorisation

    const overlapping = await this.divisionRepo.findOverlappingThumuns(
      hw.start_surah,
      hw.start_ayah,
      hw.end_surah,
      hw.end_ayah
    );

    for (const { hizb_number, thumun_number } of overlapping) {
      await this.progressRepo.recalculateFromHomeworks(
        hw.student_id,
        hizb_number,
        thumun_number,
        (hw.is_pre_memorized ?? 0) as 0 | 1
      );
    }
  }

  /**
   * Recalculates all progress for a student based on all their homeworks.
   * Useful when homeworks are deleted or modified.
   */
  async recalculateAllProgress(studentId: string): Promise<void> {
    const homeworks = await this.homeworkRepo.findByStudentId(studentId);
    const thumunSet = new Set<string>();

    for (const hw of homeworks) {
      if (!hw.start_surah || !hw.end_surah) continue;
      const overlapping = await this.divisionRepo.findOverlappingThumuns(
        hw.start_surah,
        hw.start_ayah,
        hw.end_surah,
        hw.end_ayah
      );
      for (const { hizb_number, thumun_number } of overlapping) {
        thumunSet.add(`${hizb_number}-${thumun_number}`);
      }
    }

    const existing = await this.progressRepo.findByStudentId(studentId);
    for (const p of existing) {
      thumunSet.add(`${p.hizb_number}-${p.thumun_number}`);
    }

    for (const key of thumunSet) {
      const [h, t] = key.split('-').map(Number);
      await this.progressRepo.recalculateFromHomeworks(studentId, h, t);
    }
  }

  /**
   * Build the visualizer view-model: only Hizbs that have at least one
   * memorised Thumun, sorted by hizb_number ascending.
   * Also returns the overall Quran completion percentage.
   */
  async getStudentProgressVM(studentId: string): Promise<{
    hizbs: HizbProgressVM[];
    overallPct: number;
  }> {
    const rows = await this.progressRepo.findByStudentId(studentId);

    if (rows.length === 0) return { hizbs: [], overallPct: 0 };

    // Group by hizb
    const hizbMap = new Map<number, typeof rows>();
    for (const row of rows) {
      if (!hizbMap.has(row.hizb_number)) hizbMap.set(row.hizb_number, []);
      hizbMap.get(row.hizb_number)!.push(row);
    }

    const hizbs: HizbProgressVM[] = [];

    for (const [hizbNumber, thumunRows] of hizbMap.entries()) {
      const thumuns: ThumunProgressVM[] = thumunRows.map((r) => ({
        hizb_number: r.hizb_number,
        thumun_number: r.thumun_number,
        average_score: r.average_score,
        review_count: r.review_count,
        last_graded_date: r.last_graded_date ?? null,
        is_pre_memorized: r.is_pre_memorized === 1,
        decay_status: this.computeDecayStatus(r.last_graded_date ?? null),
      }));

      const memorizedCount = thumuns.length;
      const completionPct = (memorizedCount / THUMUNS_PER_HIZB) * 100;
      const avgScore = memorizedCount
        ? thumuns.reduce((s, t) => s + t.average_score, 0) / memorizedCount
        : 0;

      // Hizb decay = worst status of all its Thumuns
      const decayPriority: Record<DecayStatus, number> = {
        fresh: 0,
        aging: 1,
        due: 2,
      };
      const worstDecay = thumuns.reduce<DecayStatus>(
        (worst, t) =>
          decayPriority[t.decay_status] > decayPriority[worst]
            ? t.decay_status
            : worst,
        'fresh'
      );

      hizbs.push({
        hizb_number: hizbNumber,
        memorized_count: memorizedCount,
        completion_pct: completionPct,
        avg_score: avgScore,
        decay_status: worstDecay,
        thumuns: thumuns.sort((a, b) => a.thumun_number - b.thumun_number),
      });
    }

    hizbs.sort((a, b) => a.hizb_number - b.hizb_number);

    // Overall completion: total memorised Thumuns / 480 (60 × 8)
    const totalMemorised = rows.length;
    const overallPct = Math.round((totalMemorised / 480) * 100 * 10) / 10;

    return { hizbs, overallPct };
  }

  /**
   * Onboard a student with pre-memorised Thumuns.
   * Also creates a synthetic homework record per Hizb range (is_pre_memorized=1)
   * so the grading history remains coherent.
   */
  async onboardPreMemorized(
    studentId: string,
    circleId: string,
    thumuns: Array<{ hizb_number: number; thumun_number: number }>
  ): Promise<void> {
    // 1. Bulk-insert progress records directly
    await this.progressRepo.bulkInsertPreMemorized(studentId, thumuns);
  }

  // ── Pure helpers ──────────────────────────────────────────────────────────

  /**
   * Compute the visual decay status from a last-graded date.
   * Thresholds: ≤14 d → fresh, 15–30 d → aging, >30 d or null → due
   */
  computeDecayStatus(lastGradedDate: string | null): DecayStatus {
    if (!lastGradedDate) return 'due';
    const days = Math.floor(
      (Date.now() - new Date(lastGradedDate).getTime()) / 86_400_000
    );
    if (days <= DECAY_FRESH_DAYS) return 'fresh';
    if (days <= DECAY_AGING_DAYS) return 'aging';
    return 'due';
  }

  /** Human-readable Arabic label for an average score. */
  scoreLabel(avgScore: number): string {
    if (avgScore >= 3.5) return 'ممتاز';
    if (avgScore >= 2.5) return 'جيد جداً';
    if (avgScore >= 1.5) return 'جيد';
    if (avgScore > 0) return 'يحتاج مراجعة';
    return '—';
  }
}

// ── Internal helper (keeps SQL out of the service) ───────────────────────────

/**
 * A lightweight DB helper to find Thumuns that overlap an ayah range.
 * Extracted as a separate injectable so StudentMushafProgressRepository
 * doesn't need to know about ayah-range lookups.
 */
@Injectable({ providedIn: 'root' })
class _QuranDivisionsHelper extends BaseRepository {
  /**
   * Return all (hizb_number, thumun_number) pairs whose ayah range
   * overlaps the given start→end range.
   *
   * Overlap condition:
   *   division.start <= hw.end  AND  division.end >= hw.start
   *   (encoded as pair comparisons on surah/ayah)
   */
  // async findOverlappingThumuns(
  //   startSurah: number, startAyah: number,
  //   endSurah:   number, endAyah:   number
  // ): Promise<Array<{ hizb_number: number; thumun_number: number }>> {
  //   return this.query<{ hizb_number: number; thumun_number: number }>(
  //     `SELECT hizb_number, thumun_number
  //      FROM quran_divisions
  //      WHERE
  //        -- division starts before or at hw end
  //        (start_surah_id < ? OR (start_surah_id = ? AND start_ayah_number <= ?))
  //        AND
  //        -- division ends on or after hw start
  //        (end_surah_id > ? OR (end_surah_id = ? AND end_ayah_number >= ?))`,
  //     [
  //       endSurah, endSurah, endAyah,
  //       startSurah, startSurah, startAyah,
  //     ]
  //   );
  // }

  async findOverlappingThumuns(
    startSurah: number,
    startAyah: number,
    endSurah: number,
    endAyah: number
  ): Promise<Array<{ hizb_number: number; thumun_number: number }>> {
   
    // Convert to single sequential coordinates
    const startCoordinate = startSurah * 10000 + startAyah;
    const endCoordinate = endSurah * 10000 + endAyah;

    const result = await this.query<{
      hizb_number: number;
      thumun_number: number;
    }>(
      `SELECT hizb_number, thumun_number
       FROM quran_divisions
       WHERE 
           -- Thumun Start Coordinate <= Passage End Coordinate
           ((start_surah_id * 10000) + start_ayah_number) <= ?
           AND 
           -- Thumun End Coordinate >= Passage Start Coordinate
           ((end_surah_id * 10000) + end_ayah_number) >= ?
       ORDER BY 
           hizb_number, thumun_number;`,
      [endCoordinate, startCoordinate]
    );

    return result;
  }
}
