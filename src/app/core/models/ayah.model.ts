/** Ayah model – matches the `ayahs` table schema. */
export interface Ayah {
  id?: number;          // absolute verse number 1–6236
  surah_id: number;
  ayah_number: number;  // verse number relative to its surah
  text_warsh: string;   // Arabic text (Warsh recitation)
}
