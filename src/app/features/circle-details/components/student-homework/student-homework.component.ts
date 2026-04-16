import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonButtons,
  ModalController,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonList,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  checkmarkCircle,
  checkmarkCircleOutline,
  alertCircle,
  eyeOutline,
  eyeOffOutline,
  arrowDownOutline,
  bookmarkOutline,
  bookOutline,
} from 'ionicons/icons';
import {
  Student,
  Homework,
  Ayah,
  Surah,
  HomeworkRepository,
  QuranRepository,
  GradingMarksHelper,
} from '@core';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea,
    IonList,
  ],
  selector: 'app-student-homework',
  templateUrl: './student-homework.component.html',
  styleUrls: ['./student-homework.component.scss'],
})
export class StudentHomeworkComponent implements OnInit {
  @Input() student!: Student;
  @Input() circleId!: string;
  @Input() isSharedCircle: boolean = false;

  private modalCtrl = inject(ModalController);
  private homeworkRepo = inject(HomeworkRepository);
  private quranRepo = inject(QuranRepository);
  private gradingMarksHelper = inject(GradingMarksHelper);

  ungradedHomework: Homework | null = null;
  quranPassage: Ayah[] = [];
  surahs: Surah[] = [];
  grades = this.gradingMarksHelper.gradeMarks;
  // Grading Form
  gradeMark: string = '';
  mistakesCount: number = 0;
  remark: string = '';

  // New Homework Form
  newStartSurah: number | null = null;
  newStartAyah: number | null = null;
  newEndSurah: number | null = null;
  newEndAyah: number | null = null;
  
  // Quran Passage Display State
  showQuranPassage: boolean = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;

  get totalPages(): number {
    return Math.ceil(this.quranPassage.length / this.itemsPerPage);
  }

  get paginatedPassage(): Ayah[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.quranPassage.slice(startIndex, startIndex + this.itemsPerPage);
  }

  toggleQuranPassage() {
    this.showQuranPassage = !this.showQuranPassage;
    if (this.showQuranPassage) {
      this.currentPage = 1;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  async ngOnInit() {
    addIcons({
      close,
      'checkmark-circle': checkmarkCircle,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle': alertCircle,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'arrow-down-outline': arrowDownOutline,
      'bookmark-outline': bookmarkOutline,
      'book-outline': bookOutline,
    });
    this.surahs = await this.quranRepo.getAllSurahs();
    await this.loadUngradedHomework();
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async loadUngradedHomework() {
    if (!this.student.id) return;
    const ungradedList = await this.homeworkRepo.findUngraded(this.student.id);
    if (ungradedList && ungradedList.length > 0) {
      this.ungradedHomework = ungradedList[0]; // the most recent one
      await this.loadQuranPassage(this.ungradedHomework);
    } else {
      this.ungradedHomework = null;
      this.quranPassage = [];
      await this.prefillNextAssignment();
    }
  }

  async prefillNextAssignment() {
    if (!this.student.id) return;
    const hwList = await this.homeworkRepo.findByStudentId(this.student.id);
    const gradedList = hwList.filter((h) => h.graded_date !== null);

    if (gradedList.length > 0) {
      // hwList is already ordered by date_assigned DESC usually, but graded_date?
      // We can just take the first graded one assuming the array is mostly sorted by newest.
      const lastHw = gradedList[0];

      let nextSurah = lastHw.end_surah;
      let nextAyah = lastHw.end_ayah + 1;
      const maxVerses = this.getMaxAyahs(nextSurah);

      if (nextAyah > maxVerses) {
        nextSurah++;
        nextAyah = 1;
      }

      if (nextSurah <= 114) {
        this.newStartSurah = nextSurah;
        this.newStartAyah = nextAyah;
        this.newEndSurah = nextSurah;
      }
    }
  }

  onStartSurahChange() {
    if (this.newStartSurah && !this.newEndSurah) {
      this.newEndSurah = this.newStartSurah;
    }
  }


  async loadQuranPassage(hw: Homework) {
    this.quranPassage = await this.quranRepo.getAyahRange(
      hw.start_surah,
      hw.start_ayah,
      hw.end_surah,
      hw.end_ayah,
    );
  }

  getSurahName(surahId: number): string {
    const s = this.surahs.find((x) => x.id === surahId);
    return s ? s.name_arabic : 'Unknown';
  }

  getMaxAyahs(surahId: number | null): number {
    if (!surahId) return 0;
    const s = this.surahs.find((x) => x.id === Number(surahId));
    return s ? s.verses_count : 0;
  }

  async submitGrade() {
    if (!this.ungradedHomework || !this.ungradedHomework.id) return;
    if (!this.gradeMark) {
      alert('الرجاء اختيار التقييم.');
      return;
    }

    await this.homeworkRepo.grade(
      this.ungradedHomework.id,
      this.gradeMark,
      this.mistakesCount,
      this.remark,
    );

    // Refresh state
    await this.loadUngradedHomework();
  }

  async assignNewHomework() {
    if (!this.student.id) return;
    if (
      !this.newStartSurah ||
      !this.newStartAyah ||
      !this.newEndSurah ||
      !this.newEndAyah
    ) {
      alert('الرجاء ملء جميع حقول الواجب الجديد.');
      return;
    }

    try {
      await this.homeworkRepo.create({
        student_id: this.student.id,
        circle_id: this.circleId,
        start_surah: this.newStartSurah,
        start_ayah: this.newStartAyah,
        end_surah: this.newEndSurah,
        end_ayah: this.newEndAyah,
      });

      // After assigning, reload so the newly assigned shows as ungraded.
      await this.loadUngradedHomework();
    } catch (err) {
      console.error('Failed to assign homework:', err);
    }
  }
}
