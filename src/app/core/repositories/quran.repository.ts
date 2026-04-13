import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';
import { Surah } from '../models/surah.model';
import { Ayah } from '../models/ayah.model';

/**
 * QuranRepository
 *
 * Read-only access to the Quran text seeded from assets/inserts.sql.
 * Uses the `surahs` and `ayahs` tables.
 */
@Injectable({ providedIn: 'root' })
export class QuranRepository extends BaseRepository {

  // ── Surahs ──────────────────────────────────────────────────────────────

  async getAllSurahs(): Promise<Surah[]> {
    return this.query<Surah>('SELECT * FROM surahs ORDER BY id ASC');
  }

  async getSurahById(id: number): Promise<Surah | null> {
    const rows = await this.query<Surah>('SELECT * FROM surahs WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  // ── Ayahs ────────────────────────────────────────────────────────────────

  /** Get all ayahs of a surah in order. */
  async getAyahsBySurah(surahId: number): Promise<Ayah[]> {
    return this.query<Ayah>(
      'SELECT * FROM ayahs WHERE surah_id = ? ORDER BY ayah_number ASC',
      [surahId]
    );
  }

  /** Get a single ayah by surah + relative verse number. */
  async getAyah(surahId: number, ayahNumber: number): Promise<Ayah | null> {
    const rows = await this.query<Ayah>(
      'SELECT * FROM ayahs WHERE surah_id = ? AND ayah_number = ?',
      [surahId, ayahNumber]
    );
    return rows[0] ?? null;
  }

  /**
   * Get a range of ayahs (used for homework display).
   * Handles cross-surah ranges: startSurah:startAyah → endSurah:endAyah
   */
  async getAyahRange(
    startSurah: number,
    startAyah: number,
    endSurah: number,
    endAyah: number
  ): Promise<Ayah[]> {
    if (startSurah === endSurah) {
      // Simple same-surah range
      return this.query<Ayah>(
        `SELECT * FROM ayahs
         WHERE surah_id = ?
           AND ayah_number BETWEEN ? AND ?
         ORDER BY ayah_number ASC`,
        [startSurah, startAyah, endAyah]
      );
    }

    // Cross-surah: get tail of startSurah + full middle surahs + head of endSurah
    return this.query<Ayah>(
      `SELECT * FROM ayahs
       WHERE (surah_id = ? AND ayah_number >= ?)
          OR (surah_id > ? AND surah_id < ?)
          OR (surah_id = ? AND ayah_number <= ?)
       ORDER BY surah_id ASC, ayah_number ASC`,
      [startSurah, startAyah, startSurah, endSurah, endSurah, endAyah]
    );
  }

  /** Full-text search on the Warsh text (simple LIKE). */
  async searchText(query: string): Promise<Ayah[]> {
    return this.query<Ayah>(
      `SELECT * FROM ayahs WHERE text_warsh LIKE ? ORDER BY surah_id ASC, ayah_number ASC LIMIT 50`,
      [`%${query}%`]
    );
  }
}
