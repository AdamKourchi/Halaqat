import { inject, Injectable } from '@angular/core';
import ExcelJS from 'exceljs';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Homework } from '../models/homework.model';
import { Student } from '../models/student.model';
import { Platform } from '@ionic/angular';
import {
  QuranRepository,
  QuranDivisionRepository,
  CircleRepository,
  TeacherRepository,
  GradingMarksHelper,
} from '@core';

/** How homework ranges appear in the exported Excel file. */
export type ExcelDisplayMode = 'ayah' | 'hizb';

// ─── Internal types ────────────────────────────────────────────────────────────

/** Pre-processed homework data stored per student per date. */
/** Pre-processed homework data stored per student per date. */
interface ProcessedHw {
  line1: string;
  line2: string;
  mark: string;
  remark: string;
  /** Keep the raw number so we can sum it up for the weekly total */
  rawThumunCount: number; 
  /** Formatted string (optional per day, but good to keep) */
  thumunCount: string;
}

/** A week bucket produced by groupDatesIntoWeeks(). */
interface WeekGroup {
  label: string; // e.g. "الأسبوع الأول"
  dates: string[]; // ISO date strings belonging to the week
}

// ─── Arabic ordinal week labels (extend as needed) ─────────────────────────────
const ARABIC_WEEK_ORDINALS: string[] = [
  'الأسبوع الأول',
  'الأسبوع الثاني',
  'الأسبوع الثالث',
  'الأسبوع الرابع',
  'الأسبوع الخامس',
  'الأسبوع السادس',
  'الأسبوع السابع',
  'الأسبوع الثامن',
];

// ─── Styling constants ─────────────────────────────────────────────────────────
const COLOR_ABSENT_BG = 'FFFFCCCC'; // light red fill for absent cells
const COLOR_WEEK_HEADER_BG = 'FFD9E1F2'; // soft blue for week group header
const COLOR_TOTAL_HEADER_BG = 'FFFFE699'; // amber for مجموع الحفظ header
const COLOR_TITLE_RED = 'FF990000';
const COLOR_TITLE_BLUE = 'FF0055A4';

const ROWS_PER_STUDENT = 4; // line1, line2, mark, remark

@Injectable({ providedIn: 'root' })
export class ExcelService {
  constructor(private platform: Platform) {}

  private quranRepo = inject(QuranRepository);
  private quranDivisionRepo = inject(QuranDivisionRepository);
  private circleRepo = inject(CircleRepository);
  private teacherRepo = inject(TeacherRepository);
  private gradingMarksHelper = inject(GradingMarksHelper);

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async getSurahName(id: number): Promise<string> {
    try {
      const surat = await this.quranRepo.getSurahById(id);
      return surat?.name_arabic || String(id);
    } catch {
      return String(id);
    }
  }

  private async buildRangeLines(
    hw: Homework,
    mode: ExcelDisplayMode
  ): Promise<[string, string]> {
    if (mode === 'hizb') {
      const label = await this.quranDivisionRepo.fromAyahRange(
        hw.start_surah,
        hw.start_ayah,
        hw.end_surah,
        hw.end_ayah
      );
      if (label) return [label, ''];
    }
    const startName = await this.getSurahName(hw.start_surah);
    const endName = await this.getSurahName(hw.end_surah);
    return [
      `من سورة ${startName} ${hw.start_ayah}`,
      `إلى سورة ${endName} ${hw.end_ayah}`,
    ];
  }

  /**
   * Determine how many whole thumuns a homework record covers.
   * A homework is a thumun if it exactly matches one entry in quran_divisions.
   * Returns 1 if it is exactly one thumun, 0 otherwise.
   * (Extend this logic if multi-thumun homeworks are possible.)
   */
  private async resolveThumunCount(hw: Homework): Promise<number> {
    try {
      return await this.quranDivisionRepo.getThumunCountBetween(
        hw.start_surah,
        hw.start_ayah,
        hw.end_surah,
        hw.end_ayah
      );
    } catch {
      return 0;
    }
  }

  static formatThumunCountDisplay(totalThumuns: number): string {
    if (totalThumuns <= 0) return '';

    const hizbs = Math.floor(totalThumuns / 8);
    const thumuns = totalThumuns % 8;

    let hizbText = '';
    if (hizbs === 1) hizbText = 'حزب';
    else if (hizbs === 2) hizbText = 'حزبان';
    else if (hizbs >= 3 && hizbs <= 10) hizbText = `${hizbs} أحزاب`;
    else if (hizbs > 10) hizbText = `${hizbs} حزباً`;

    let thumunText = '';
    if (thumuns === 1) thumunText = 'ثُمن';
    else if (thumuns === 2) thumunText = 'ثمنان';
    else if (thumuns >= 3) thumunText = `${thumuns} أثمان`;

    // Combine them with "و" if both exist
    if (hizbText && thumunText) {
      return `${hizbText} و${thumunText}`;
    }
    
    return hizbText || thumunText;
  }

  private async getCircleData(circleId: string) {
    const circle = await this.circleRepo.findById(circleId);
    const teacher = circle?.teacher_id
      ? await this.teacherRepo.findById(circle.teacher_id)
      : null;
    return { circle, teacher };
  }

  private formatDateHeader(dateString: string): string {
    const dateObj = new Date(dateString);
    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
    return `حصة ${dateString}\n${dayName}`;
  }

  /**
   * Groups a sorted array of ISO date strings into 7-day calendar weeks
   * (Monday–Sunday). Sessions within the same ISO week are grouped together,
   * so a week may contain 1–7 dates depending on which days classes were held.
   */
  private groupDatesIntoWeeks(sortedDates: string[]): WeekGroup[] {
    const groups: WeekGroup[] = [];
    let currentWeekKey = '';
    let weekIndex = 0;

    for (const iso of sortedDates) {
      const d = new Date(iso);
      // ISO week number approach: shift so Monday = day 0
      const day = d.getDay(); // 0=Sun … 6=Sat
      const mondayOffset = (day + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - mondayOffset);
      const weekKey = monday.toISOString().slice(0, 10); // YYYY-MM-DD of that Monday

      if (weekKey !== currentWeekKey) {
        currentWeekKey = weekKey;
        groups.push({
          label: ARABIC_WEEK_ORDINALS[weekIndex] ?? `الأسبوع ${weekIndex + 1}`,
          dates: [],
        });
        weekIndex++;
      }
      groups[groups.length - 1].dates.push(iso);
    }
    return groups;
  }

  /**
   * Pre-processes all homeworks into a Map for O(1) lookup.
   * Structure: studentId → dateAssigned → ProcessedHw
   */
private async buildStudentDataMap(
    homeworks: Homework[],
    displayMode: ExcelDisplayMode
  ): Promise<Map<string, Map<string, ProcessedHw>>> {
    const map = new Map<string, Map<string, ProcessedHw>>();

    for (const hw of homeworks) {
      if (!hw.student_id || !hw.date_assigned) continue;

      const [line1, line2] = await this.buildRangeLines(hw, displayMode);
      const mark = this.gradingMarksHelper.getMarkLabel(hw.grade_mark);
      
      // Calculate and save the RAW number for math, and the string for display
      const rawThumunCount = await this.resolveThumunCount(hw);
      const thumunCount = ExcelService.formatThumunCountDisplay(rawThumunCount);
      
      const remark = hw.remark ?? '';

      if (!map.has(hw.student_id)) map.set(hw.student_id, new Map());
      map
        .get(hw.student_id)!
        .set(hw.date_assigned, { line1, line2, mark, remark, rawThumunCount, thumunCount });
    }

    return map;
  }

  // ─── ExcelJS drawing helpers ──────────────────────────────────────────────────

  private applyThinBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private applyThickBottomBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: cell.border?.top ?? { style: 'thin' },
      left: cell.border?.left ?? { style: 'thin' },
      right: cell.border?.right ?? { style: 'thin' },
      bottom: { style: 'medium' }, // thick separator between students
    };
  }

  private applyAbsentFill(cell: ExcelJS.Cell) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_ABSENT_BG },
    };
  }

  private centerAlign(cell: ExcelJS.Cell, wrapText = false) {
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText };
  }

  /**
   * Writes the two-row column-header block (week group row + date row)
   * and returns the flat ordered array of column descriptors.
   *
   * Each date column is followed immediately by its week's summary column
   * at the END of that week's group.
   *
   * Returns a descriptor array parallel to the actual data columns so the
   * fill loop can reference it by index.
   */
private writeColumnHeaders(
    worksheet: ExcelJS.Worksheet,
    weekGroups: WeekGroup[],
    weekHeaderRow: number,
    dateHeaderRow: number,
    startCol: number
  ): Array<{ type: 'date'; date: string; weekIndex: number } | { type: 'total'; weekIndex: number }> { // <-- Add weekIndex here
    
    const descriptors: Array<
      { type: 'date'; date: string; weekIndex: number } | { type: 'total'; weekIndex: number }
    > = [];
    let col = startCol;

    for (let wi = 0; wi < weekGroups.length; wi++) {
      const week = weekGroups[wi];
      const weekStartCol = col;

      for (const date of week.dates) {
        worksheet.getColumn(col).width = 22;

        const dateCell = worksheet.getCell(dateHeaderRow, col);
        dateCell.value = this.formatDateHeader(date);
        dateCell.font = { bold: true };
        this.centerAlign(dateCell, true);
        this.applyThinBorder(dateCell);

        // Add the weekIndex here so we can match it up later
        descriptors.push({ type: 'date', date, weekIndex: wi }); 
        col++;
      }
      // ── Weekly total column ──
      worksheet.getColumn(col).width = 16;

      const totalHeaderCell = worksheet.getCell(dateHeaderRow, col);
      totalHeaderCell.value = 'مجموع الحفظ';
      totalHeaderCell.font = { bold: true };
      totalHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_TOTAL_HEADER_BG },
      };
      this.centerAlign(totalHeaderCell, true);
      this.applyThinBorder(totalHeaderCell);

      descriptors.push({ type: 'total', weekIndex: wi });
      const weekEndCol = col;
      col++;

      // ── Week group header (spans date cols + total col) ──
      if (weekStartCol === weekEndCol) {
        // Only one column — no merge needed
        const wCell = worksheet.getCell(weekHeaderRow, weekStartCol);
        wCell.value = week.label;
        wCell.font = { bold: true };
        wCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_WEEK_HEADER_BG },
        };
        this.centerAlign(wCell);
        this.applyThinBorder(wCell);
      } else {
        worksheet.mergeCells(
          weekHeaderRow,
          weekStartCol,
          weekHeaderRow,
          weekEndCol
        );
        const wCell = worksheet.getCell(weekHeaderRow, weekStartCol);
        wCell.value = week.label;
        wCell.font = { bold: true };
        wCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_WEEK_HEADER_BG },
        };
        this.centerAlign(wCell);
        this.applyThinBorder(wCell);
      }
    }

    return descriptors;
  }

  /**
   * Fills one student's 4-row block starting at `startRow`.
   * Applies absent styling, thick bottom border on row 4, and weekly totals.
   */
private fillStudentRows(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    startDataCol: number,
    descriptors: Array<{ type: 'date'; date: string; weekIndex: number } | { type: 'total'; weekIndex: number }>,
    weekGroups: WeekGroup[],
    studentHws: Map<string, ProcessedHw>
  ) {
    const r0 = startRow; // line1
    const r1 = startRow + 1; // line2
    const r2 = startRow + 2; // mark
    const r3 = startRow + 3; // remark

    // Accumulate thumun totals per week
    const weekThumunTotals = new Array<number>(weekGroups.length).fill(0);

    for (let di = 0; di < descriptors.length; di++) {
      const desc = descriptors[di];
      const col = startDataCol + di;

      if (desc.type === 'date') {
        const hw = studentHws.get(desc.date);

        if (hw) {
          const isAbsent = hw.mark === 'غائب' || hw.mark === 'Absent';

          worksheet.getCell(r0, col).value = hw.line1;
          worksheet.getCell(r1, col).value = hw.line2;
          worksheet.getCell(r2, col).value = hw.mark;
          worksheet.getCell(r3, col).value = hw.remark;

          // Add today's thumuns to this week's running total!
          weekThumunTotals[desc.weekIndex] += hw.rawThumunCount;

          if (isAbsent) {
            [r0, r1, r2, r3].forEach((r) =>
              this.applyAbsentFill(worksheet.getCell(r, col))
            );
          }
        } else {
          worksheet.getCell(r0, col).value = '-';
          worksheet.getCell(r1, col).value = '-';
          worksheet.getCell(r2, col).value = '-';
          worksheet.getCell(r3, col).value = '-';
        }
      } else {
        // type === 'total'
        const rawTotal = weekThumunTotals[desc.weekIndex];
        
        // Format the final total into Arabic text!
        const formattedTotal = ExcelService.formatThumunCountDisplay(rawTotal);

        // Merge the 4 rows for the total cell so it appears centred
        worksheet.mergeCells(r0, col, r3, col);
        const totalCell = worksheet.getCell(r0, col);
        
        // Display the formatted string (e.g. "حزب وثمنان") instead of the raw number
        totalCell.value = formattedTotal || '-'; 
        totalCell.font = { bold: true, size: 13 };
        totalCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_TOTAL_HEADER_BG },
        };
        this.centerAlign(totalCell);
      }
      // Apply thin borders to all 4 data rows for this column
      for (const r of [r0, r1, r2]) {
        const cell = worksheet.getCell(r, col);
        this.centerAlign(cell);
        this.applyThinBorder(cell);
      }

      // Row 4 (remark) gets thin borders on top/left/right but THICK bottom
      const remarkCell = worksheet.getCell(r3, col);
      this.centerAlign(remarkCell);
      remarkCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'medium' }, // ← thick student separator (Feature 5)
      };
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  async generateStudentExcel(
    student: Student,
    homeworks: Homework[],
    displayMode: ExcelDisplayMode = 'ayah'
  ) {
    const { circle, teacher } = await this.getCircleData(student.circle_id!);

    const sortedDates = Array.from(
      new Set(homeworks.map((h) => h.date_assigned!))
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const weekGroups = this.groupDatesIntoWeeks(sortedDates);
    const studentDataMap = await this.buildStudentDataMap(
      homeworks,
      displayMode
    );
    const studentHws =
      studentDataMap.get(student.id!) ?? new Map<string, ProcessedHw>();

    // ── Workbook setup ──
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('حصيلة');
    worksheet.views = [{ rightToLeft: true }];

    // Row 1 – Titles
    worksheet.getRow(1).height = 30;
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'حلقة : ' + (circle?.name || 'غير محدد');
    titleCell.font = { size: 18, bold: true, color: { argb: COLOR_TITLE_RED } };
    this.centerAlign(titleCell);

    worksheet.mergeCells('G1:I1');
    const subTitleCell = worksheet.getCell('G1');
    subTitleCell.value = 'المشرف : ' + (teacher?.name || 'غير محدد');
    subTitleCell.font = {
      size: 14,
      bold: true,
      color: { argb: COLOR_TITLE_BLUE },
    };
    this.centerAlign(subTitleCell);

    // Row 2 is a visual gap (intentionally empty)

    // Rows 3 & 4 – Column headers (week group row = 3, date row = 4)
    worksheet.getRow(3).height = 24;
    worksheet.getRow(4).height = 36;

    // Column A – Student name header (rows 3–4 merged)
    worksheet.getColumn(1).width = 25;
    worksheet.mergeCells('A3:A4');
    const nameHeaderCell = worksheet.getCell('A3');
    nameHeaderCell.value = 'اسم الطالب';
    nameHeaderCell.font = { bold: true };
    this.centerAlign(nameHeaderCell);
    this.applyThinBorder(nameHeaderCell);

    // Write week/date headers starting at column 2
    const descriptors = this.writeColumnHeaders(worksheet, weekGroups, 3, 4, 2);

    // Row 5 onward – Student data (4 rows per student)
    const studentStartRow = 5;

    // Merge column A for the 4 student rows
    worksheet.mergeCells(
      `A${studentStartRow}:A${studentStartRow + ROWS_PER_STUDENT - 1}`
    );
    const nameCell = worksheet.getCell(`A${studentStartRow}`);
    nameCell.value = student.name;
    nameCell.font = { bold: true, size: 14 };
    this.centerAlign(nameCell);

    // Apply thick bottom border to the name cell too (right side of student block)
    nameCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'medium' },
    };

    this.fillStudentRows(
      worksheet,
      studentStartRow,
      2,
      descriptors,
      weekGroups,
      studentHws
    );

    await this.saveAndShare(workbook, `حصيلة_${student.name}.xlsx`);
  }

  async generateCircleExcel(
    students: Student[],
    homeworks: Homework[],
    displayMode: ExcelDisplayMode = 'ayah'
  ) {
    const { circle, teacher } = await this.getCircleData(
      students[0].circle_id!
    );

    const sortedDates = Array.from(
      new Set(homeworks.map((h) => h.date_assigned!))
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const weekGroups = this.groupDatesIntoWeeks(sortedDates);
    const studentDataMap = await this.buildStudentDataMap(
      homeworks,
      displayMode
    );

    // ── Workbook setup ──
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('حصيلة');
    worksheet.views = [{ rightToLeft: true }];

    // Row 1 – Titles
    worksheet.getRow(1).height = 30;
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'حلقة : ' + (circle?.name || 'غير محدد');
    titleCell.font = { size: 18, bold: true, color: { argb: COLOR_TITLE_RED } };
    this.centerAlign(titleCell);

    worksheet.mergeCells('G1:I1');
    const subTitleCell = worksheet.getCell('G1');
    subTitleCell.value = 'المشرف : ' + (teacher?.name || 'غير محدد');
    subTitleCell.font = {
      size: 14,
      bold: true,
      color: { argb: COLOR_TITLE_BLUE },
    };
    this.centerAlign(subTitleCell);

    // Rows 3 & 4 – Column headers
    worksheet.getRow(3).height = 24;
    worksheet.getRow(4).height = 36;
    worksheet.getColumn(1).width = 25;

    worksheet.mergeCells('A3:A4');
    const nameHeaderCell = worksheet.getCell('A3');
    nameHeaderCell.value = 'اسم الطالب';
    nameHeaderCell.font = { bold: true };
    this.centerAlign(nameHeaderCell);
    this.applyThinBorder(nameHeaderCell);

    const descriptors = this.writeColumnHeaders(worksheet, weekGroups, 3, 4, 2);

    // ── Student rows ──
    let currentRow = 5;

    for (const student of students) {
      const studentHws =
        studentDataMap.get(student.id!) ?? new Map<string, ProcessedHw>();
      const endRow = currentRow + ROWS_PER_STUDENT - 1;

      worksheet.mergeCells(`A${currentRow}:A${endRow}`);
      const nameCell = worksheet.getCell(`A${currentRow}`);
      nameCell.value = student.name;
      nameCell.font = { bold: true, size: 14 };
      this.centerAlign(nameCell);
      nameCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'medium' },
      };

      this.fillStudentRows(
        worksheet,
        currentRow,
        2,
        descriptors,
        weekGroups,
        studentHws
      );

      currentRow += ROWS_PER_STUDENT;
    }

    await this.saveAndShare(
      workbook,
      `حصيلة_حلقة_${circle?.name || 'Unknown'}_${new Date().getDate()}.xlsx`
    );
  }

  async generateMultipleCirclesExcel(
    students: Student[],
    homeworks: Homework[],
    displayMode: ExcelDisplayMode = 'ayah'
  ) {
    const sortedDates = Array.from(
      new Set(homeworks.map((h) => h.date_assigned!))
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const weekGroups = this.groupDatesIntoWeeks(sortedDates);

    // Group students by circle
    const studentsByCircle = new Map<string, Student[]>();
    for (const student of students) {
      if (!student.circle_id) continue;
      if (!studentsByCircle.has(student.circle_id))
        studentsByCircle.set(student.circle_id, []);
      studentsByCircle.get(student.circle_id)!.push(student);
    }

    // Pre-fetch circle names
    const circleNamesMap = new Map<string, string>();
    for (const circleId of studentsByCircle.keys()) {
      const { circle } = await this.getCircleData(circleId);
      circleNamesMap.set(circleId, circle?.name ?? 'غير محدد');
    }

    // Pre-process all homeworks
    const studentDataMap = await this.buildStudentDataMap(
      homeworks,
      displayMode
    );

    // ── Workbook setup ──
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Summary');
    worksheet.views = [{ rightToLeft: true }];

    // Row 1 – Title
    worksheet.getRow(1).height = 30;
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير الحلقات المحددة';
    titleCell.font = { size: 18, bold: true, color: { argb: COLOR_TITLE_RED } };
    this.centerAlign(titleCell);

    // Rows 3 & 4 – Column headers
    worksheet.getRow(3).height = 24;
    worksheet.getRow(4).height = 36;
    worksheet.getColumn(1).width = 25; // Circle name
    worksheet.getColumn(2).width = 25; // Student name

    // Header for columns A & B (span both header rows)
    worksheet.mergeCells('A3:A4');
    const circleHeaderCell = worksheet.getCell('A3');
    circleHeaderCell.value = 'اسم الحلقة';
    circleHeaderCell.font = { bold: true };
    this.centerAlign(circleHeaderCell);
    this.applyThinBorder(circleHeaderCell);

    worksheet.mergeCells('B3:B4');
    const studentHeaderCell = worksheet.getCell('B3');
    studentHeaderCell.value = 'اسم الطالب';
    studentHeaderCell.font = { bold: true };
    this.centerAlign(studentHeaderCell);
    this.applyThinBorder(studentHeaderCell);

    // Date/week headers start at column 3
    const descriptors = this.writeColumnHeaders(worksheet, weekGroups, 3, 4, 3);

    // ── Data rows ──
    let currentRow = 5;

    for (const [circleId, circleStudents] of studentsByCircle.entries()) {
      const circleName = circleNamesMap.get(circleId) ?? 'غير محدد';
      const startCircleRow = currentRow;

      for (const student of circleStudents) {
        const studentHws =
          studentDataMap.get(student.id!) ?? new Map<string, ProcessedHw>();
        const endRow = currentRow + ROWS_PER_STUDENT - 1;

        // Student name cell (column B)
        worksheet.mergeCells(`B${currentRow}:B${endRow}`);
        const nameCell = worksheet.getCell(`B${currentRow}`);
        nameCell.value = student.name;
        nameCell.font = { bold: true, size: 14 };
        this.centerAlign(nameCell);
        nameCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'medium' },
        };

        // Homework data starts at column 3
        this.fillStudentRows(
          worksheet,
          currentRow,
          3,
          descriptors,
          weekGroups,
          studentHws
        );

        currentRow += ROWS_PER_STUDENT;
      }

      // Circle name spans all rows for that circle (column A)
      if (startCircleRow < currentRow) {
        worksheet.mergeCells(`A${startCircleRow}:A${currentRow - 1}`);
        const circleCell = worksheet.getCell(`A${startCircleRow}`);
        circleCell.value = circleName;
        circleCell.font = { bold: true, size: 14 };
        this.centerAlign(circleCell);
        circleCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'medium' },
        };
      }
    }

    await this.saveAndShare(
      workbook,
      `تقرير_الحلقات_${new Date().getTime()}.xlsx`
    );
  }

  // ─── Save & Share ──────────────────────────────────────────────────────────────

  private async saveAndShare(workbook: ExcelJS.Workbook, fileName: string) {
    const buffer = await workbook.xlsx.writeBuffer();

    if (this.platform.is('capacitor')) {
      const base64 = this.arrayBufferToBase64(buffer as ArrayBuffer);
      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Share Report',
          url: savedFile.uri,
          dialogTitle: 'Share or Save Excel File',
        });
      } catch (e) {
        console.error('Error saving or sharing file', e);
      }
    } else {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
