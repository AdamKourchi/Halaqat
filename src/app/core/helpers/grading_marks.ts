import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GradingMarksHelper {
  public gradeMarks = [
    { key: 'Excellent', value: 'ممتاز' },
    { key: 'Very Good', value: 'جيد جدا' },
    { key: 'Good', value: 'جيد' },
    { key: 'Needs Work', value: 'حسن' },
    { key: 'Repeat', value: 'يعيد' },
    { key: 'Absent', value: 'غائب' },

  ];

  getMarkLabel(mark: string|null|undefined): string {
    if (!mark) return '-';
    switch (mark) {
      case 'Excellent':
        return 'ممتاز';
      case 'Very Good':
        return 'جيد جدا';
      case 'Good':
        return 'جيد';
      case 'Needs Work':
        return 'حسن';
      case 'Repeat':
        return 'يعيد';
      case 'Absent':
        return 'غائب';
      default:
        return '-';
    }
  }
}
