import { inject, Injectable } from '@angular/core';
import ExcelJS from 'exceljs';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Homework } from '../models/homework.model';
import { Student } from '../models/student.model';
import { Platform } from '@ionic/angular';
import { QuranRepository, CircleRepository, TeacherRepository, GradingMarksHelper } from '@core';

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  constructor(private platform: Platform) {}
  private quranRepo = inject(QuranRepository);
  private circleRepo = inject(CircleRepository);
  private teacherRepo = inject(TeacherRepository);
  private gradingMarksHelper = inject(GradingMarksHelper);
  // Helper function to get Surah name
  private async getSurahName(id: number): Promise<string> {
    try {
      const surat = await this.quranRepo.getSurahById(id);
      return surat?.name_arabic || String(id);
    } catch (error) {
      return String(id);
    }
  }

  private async getCircleData(circleId: string) {
    const circle = await this.circleRepo.findById(circleId);

    let teacher = null;

    if (circle && circle.teacher_id) {
      teacher = await this.teacherRepo.findById(circle.teacher_id);
    }

    return { circle, teacher };
  }

  // Helper function to format the date header
  private formatDateHeader(dateString: string): string {
    const dateObj = new Date(dateString);
    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
    // Returns e.g. "حصة 11-04-2026\nالخميس"
    return `حصة ${dateString}\n${dayName}`;
  }

  async generateStudentExcel(student: Student, homeworks: Homework[]) {
    const { circle, teacher } = await this.getCircleData(student.circle_id!);
    const dates = Array.from(
      new Set(homeworks.map((h) => h.date_assigned!)),
    ).sort((a, b) => {
      return new Date(a!).getTime() - new Date(b!).getTime();
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('حصيلة');

    // Right-to-left config
    worksheet.views = [{ rightToLeft: true }];

    // 1. Titles
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'حلقة : ' + (circle?.name || 'غير محدد');
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF990000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('G1:I1');
    const subTitleCell = worksheet.getCell('G1');
    subTitleCell.value = 'المشرف : ' + (teacher?.name || 'غير محدد');
    subTitleCell.font = { size: 14, bold: true, color: { argb: 'FF0055A4' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 2. Setup Columns width
    worksheet.getColumn(1).width = 25; // Student Name column

    // 3. Headers
    worksheet.getCell('A3').value = 'اسم الطالب';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Merge cells for the single student's name (Rows 4, 5, 6)
    worksheet.mergeCells('A4:A6');
    const nameCell = worksheet.getCell('A4');
    nameCell.value = student.name;
    nameCell.font = { bold: true, size: 14 };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 4. Fill Data Columns (CHANGED TO standard 'for' loop to support await)
    for (let index = 0; index < dates.length; index++) {
      const date = dates[index];
      const colIndex = index + 2; // Start from Column B (index 2)
      worksheet.getColumn(colIndex).width = 22;

      // Header Date (Row 3)
      const dateCell = worksheet.getCell(3, colIndex);
      dateCell.value = this.formatDateHeader(date);
      dateCell.font = { bold: true };
      dateCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };

      const hw = homeworks.find((h) => h.date_assigned === date);
      if (hw) {
        // Await the database calls BEFORE assigning them to the cells
        const startSurahName = await this.getSurahName(hw.start_surah);
        const endSurahName = await this.getSurahName(hw.end_surah);
        let mark = this.gradingMarksHelper.getMarkLabel(hw.grade_mark);
     

        worksheet.getCell(4, colIndex).value =
          `من سورة ${startSurahName} ${hw.start_ayah}`;
        worksheet.getCell(5, colIndex).value =
          `إلى سورة ${endSurahName} ${hw.end_ayah}`;
        worksheet.getCell(6, colIndex).value = mark;
      } else {
        worksheet.getCell(4, colIndex).value = '-';
        worksheet.getCell(5, colIndex).value = '-';
        worksheet.getCell(6, colIndex).value = '-';
      }

      // Center align data cells
      for (let r = 4; r <= 6; r++) {
        worksheet.getCell(r, colIndex).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
      }
    }

    // 5. Apply Borders
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 3 && rowNumber <= 6) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    await this.saveAndShare(workbook, `حصيلة_${student.name}.xlsx`);
  }

  async generateCircleExcel(students: Student[], homeworks: Homework[]) {
    const { circle, teacher } = await this.getCircleData(students[0].circle_id!);

    const datesSet = new Set<string>();
    homeworks.forEach((h) => datesSet.add(h.date_assigned!));
    const dates = Array.from(datesSet).sort(
      (a, b) => new Date(a!).getTime() - new Date(b!).getTime(),
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Summary');

    worksheet.views = [{ rightToLeft: true }];

    // 1. Titles
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'حلقة : ' + (circle?.name || 'غير محدد');
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF990000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('G1:I1');
    const subTitleCell = worksheet.getCell('G1');
    subTitleCell.value = 'المشرف : ' + (teacher?.name || 'غير محدد');
    subTitleCell.font = { size: 14, bold: true, color: { argb: 'FF0055A4' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getColumn(1).width = 25;

    // 2. Main Headers
    worksheet.getCell('A3').value = 'اسم الطالب';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Fill Date Headers
    for (let index = 0; index < dates.length; index++) {
      const date = dates[index];
      const colIndex = index + 2;
      worksheet.getColumn(colIndex).width = 22;

      const dateCell = worksheet.getCell(3, colIndex);
      dateCell.value = this.formatDateHeader(date);
      dateCell.font = { bold: true };
      dateCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    }

    // 3. Fill Students Data (3 rows per student)
    let currentRow = 4;

    for (const student of students) {
      const studentHw = homeworks.filter((h) => h.student_id === student.id);

      // Merge cells for the student's name
      const endRow = currentRow + 2;
      worksheet.mergeCells(`A${currentRow}:A${endRow}`);

      const nameCell = worksheet.getCell(`A${currentRow}`);
      nameCell.value = student.name;
      nameCell.font = { bold: true, size: 14 };
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Fill Homework Data for this student across dates
      for (let index = 0; index < dates.length; index++) {
        const date = dates[index];
        const colIndex = index + 2;
        const hw = studentHw.find((h) => h.date_assigned === date);

        if (hw) {
          const startSurahName = await this.getSurahName(hw.start_surah);
          const endSurahName = await this.getSurahName(hw.end_surah);
          let mark = this.gradingMarksHelper.getMarkLabel(hw.grade_mark);
         

          worksheet.getCell(currentRow, colIndex).value =
            `من سورة ${startSurahName} ${hw.start_ayah}`;
          worksheet.getCell(currentRow + 1, colIndex).value =
            `إلى سورة ${endSurahName} ${hw.end_ayah}`;
          worksheet.getCell(currentRow + 2, colIndex).value = mark;
        } else {
          worksheet.getCell(currentRow, colIndex).value = '-';
          worksheet.getCell(currentRow + 1, colIndex).value = '-';
          worksheet.getCell(currentRow + 2, colIndex).value = '-';
        }

        // Align the newly created cells
        worksheet.getCell(currentRow, colIndex).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        worksheet.getCell(currentRow + 1, colIndex).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        worksheet.getCell(currentRow + 2, colIndex).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
      }

      currentRow += 3; // Move down 3 rows for the next student
    }

    // 4. Apply Borders
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 3 && rowNumber < currentRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    await this.saveAndShare(
      workbook,
      `حصيلة_حلقة_${circle?.name || 'Unknown'}_${new Date().getDate()}.xlsx`,
    );
  }

  async generateMultipleCirclesExcel(students: Student[], homeworks: Homework[]) {
    const datesSet = new Set<string>();
    homeworks.forEach((h) => datesSet.add(h.date_assigned!));
    const dates = Array.from(datesSet).sort(
      (a, b) => new Date(a!).getTime() - new Date(b!).getTime(),
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Summary');

    worksheet.views = [{ rightToLeft: true }];

    // Group students by circle ID
    const studentsByCircle = new Map<string, Student[]>();
    for (const student of students) {
      if (!student.circle_id) continue;
      if (!studentsByCircle.has(student.circle_id)) {
        studentsByCircle.set(student.circle_id, []);
      }
      studentsByCircle.get(student.circle_id)!.push(student);
    }

    // 1. Titles
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير الحلقات المحددة';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF990000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getColumn(1).width = 25; // Circle Name
    worksheet.getColumn(2).width = 25; // Student Name

    // 2. Main Headers
    worksheet.getCell('A3').value = 'اسم الحلقة';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('B3').value = 'اسم الطالب';
    worksheet.getCell('B3').font = { bold: true };
    worksheet.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };

    // Fill Date Headers
    for (let index = 0; index < dates.length; index++) {
      const date = dates[index];
      const colIndex = index + 3; // Start from C
      worksheet.getColumn(colIndex).width = 22;

      const dateCell = worksheet.getCell(3, colIndex);
      dateCell.value = this.formatDateHeader(date);
      dateCell.font = { bold: true };
      dateCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    }

    // 3. Fill Data
    let currentRow = 4;

    for (const [circleId, circleStudents] of studentsByCircle.entries()) {
      const { circle } = await this.getCircleData(circleId);
      
      const startCircleRow = currentRow;

      for (const student of circleStudents) {
        const studentHw = homeworks.filter((h) => h.student_id === student.id);

        // Merge cells for the student's name
        const endRow = currentRow + 2;
        worksheet.mergeCells(`B${currentRow}:B${endRow}`);

        const nameCell = worksheet.getCell(`B${currentRow}`);
        nameCell.value = student.name;
        nameCell.font = { bold: true, size: 14 };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Fill Homework Data for this student across dates
        for (let index = 0; index < dates.length; index++) {
          const date = dates[index];
          const colIndex = index + 3;
          const hw = studentHw.find((h) => h.date_assigned === date);

          if (hw) {
            const startSurahName = await this.getSurahName(hw.start_surah);
            const endSurahName = await this.getSurahName(hw.end_surah);
            let mark = this.gradingMarksHelper.getMarkLabel(hw.grade_mark);
           
            worksheet.getCell(currentRow, colIndex).value =
              `من سورة ${startSurahName} ${hw.start_ayah}`;
            worksheet.getCell(currentRow + 1, colIndex).value =
              `إلى سورة ${endSurahName} ${hw.end_ayah}`;
            worksheet.getCell(currentRow + 2, colIndex).value = mark;
          } else {
            worksheet.getCell(currentRow, colIndex).value = '-';
            worksheet.getCell(currentRow + 1, colIndex).value = '-';
            worksheet.getCell(currentRow + 2, colIndex).value = '-';
          }

          worksheet.getCell(currentRow, colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
          worksheet.getCell(currentRow + 1, colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
          worksheet.getCell(currentRow + 2, colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        currentRow += 3;
      }

      // Merge cells for the circle name
      if (startCircleRow < currentRow) {
        worksheet.mergeCells(`A${startCircleRow}:A${currentRow - 1}`);
        const circleCell = worksheet.getCell(`A${startCircleRow}`);
        circleCell.value = circle?.name || 'غير محدد';
        circleCell.font = { bold: true, size: 14 };
        circleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    // 4. Apply Borders
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 3 && rowNumber < currentRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    await this.saveAndShare(
      workbook,
      `تقرير_الحلقات_${new Date().getTime()}.xlsx`,
    );
  }

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
      // Fallback for web
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
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
