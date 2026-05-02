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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonToggle,
  IonNote,
  IonPopover
} from '@ionic/angular/standalone';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Clipboard } from '@capacitor/clipboard';
import { VoiceRecorder } from 'capacitor-voice-recorder';
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
  layersOutline,
  micOutline,
  logoWhatsapp,
  radioButtonOnOutline,
  folderOpenOutline,
  stopCircleOutline,
  musicalNotesOutline,
  trashOutline,
  micCircleOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import {
  Student,
  Homework,
  Ayah,
  Surah,
  HomeworkRepository,
  QuranRepository,
  QuranDivisionRepository,
  GradingMarksHelper,
  ThumunCount,
  MushafProgressService,
  GradeMark,
} from '@core';

/** The four subdivision sizes in display order. */
const DIVISION_OPTIONS: { count: ThumunCount; label: string }[] = [
  { count: 8, label: 'الحزب كاملاً' },
  { count: 4, label: 'نصف الحزب' },
  { count: 2, label: 'ربع الحزب' },
  { count: 1, label: 'ثُمن' },
];

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
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonToggle,
    IonNote,
    IonPopover
  ],
  selector: 'app-student-homework',
  templateUrl: './student-homework.component.html',
  styleUrls: ['./student-homework.component.scss'],
})
export class StudentHomeworkComponent implements OnInit {
  @Input() student!: Student;
  @Input() circleId!: string;
  @Input() isSharedCircle: boolean = false;

  private modalCtrl        = inject(ModalController);
  private homeworkRepo     = inject(HomeworkRepository);
  private quranRepo        = inject(QuranRepository);
  private quranDivisionRepo = inject(QuranDivisionRepository);
  private gradingMarksHelper = inject(GradingMarksHelper);
  private mushafProgressService = inject(MushafProgressService);

  ungradedHomework: Homework | null = null;
  ungradedHomeworkHizbLabel: string | null = null;
  quranPassage: Ayah[] = [];
  surahs: Surah[] = [];
  grades = this.gradingMarksHelper.gradeMarks;

  // Grading Form
  gradeMark: GradeMark | '' = '';
  mistakesCount: number = 0;
  remark: string = '';
  shareGradeViaWhatsapp: boolean = false;

  // ── Assignment mode ────────────────────────────────────────────────────
  /** 'ayah' = classic Surah/Ayah mode | 'hizb' = Hizb/Thumun mode */
  assignMode: 'ayah' | 'hizb' = 'ayah';

  // ── Ayah-mode fields ──────────────────────────────────────────────────
  newStartSurah: number | null = null;
  newStartAyah: number | null = null;
  newEndSurah: number | null = null;
  newEndAyah: number | null = null;

  // ── Hizb-mode fields ──────────────────────────────────────────────────
  divisionOptions = DIVISION_OPTIONS;

  hizbNumber: number | null = null;       // 1–60
  thumunCount: ThumunCount = 8;           // selected division size
  /** Which sub-unit within the Hizb (1-based index into validSubdivisions) */
  subdivisionIndex: number = 1;

  /** Live preview of the resolved Surah:Ayah range */
  hizbPreview: string = '';
  /** Resolved range used when submitting in Hizb mode */
  private resolvedRange: { start_surah: number; start_ayah: number; end_surah: number; end_ayah: number } | null = null;

  // ── Quran Passage state ──────────────────────────────────────────────
  showQuranPassage: boolean = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // ── Optional Additions ────────────────────────────────────────────────
  shareViaWhatsapp: boolean = false;
  selectedAudioFile: File | null = null;
  isRecording = false;
  recordingTime = 0;
  private recordingTimer: any;
  isOpen = false;

  // ── Computed helpers ─────────────────────────────────────────────────

  get totalPages(): number {
    return Math.ceil(this.quranPassage.length / this.itemsPerPage);
  }

  get paginatedPassage(): Ayah[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.quranPassage.slice(startIndex, startIndex + this.itemsPerPage);
  }


presentPopover(e: Event) {
  this.isOpen = true;
}

  /**
   * The list of sub-divisions to show (e.g. for Half: 2 items;
   * for Quarter: 4 items; for Eighth: 8 items; for Full: []).
   * Each item carries its startThumun so it maps cleanly to the DB.
   */
  get validSubdivisions(): { index: number; label: string; startThumun: number }[] {
    if (this.thumunCount === 8) return [];
    return QuranDivisionRepository.validStartThumuns(this.thumunCount).map(
      (startT, i) => ({
        index: i + 1,
        startThumun: startT,
        label: QuranDivisionRepository.subdivisionLabel(startT, this.thumunCount),
      }),
    );
  }

  /** The actual startThumun that will be queried. */
  get computedStartThumun(): number {
    if (this.thumunCount === 8) return 1;
    const sub = this.validSubdivisions[this.subdivisionIndex - 1];
    return sub ? sub.startThumun : 1;
  }


  getThumunFromAya(startSurah: number, startAyah: number, endSurah: number, endAyah: number){
    return this.quranDivisionRepo.fromAyahRange(startSurah, startAyah, endSurah, endAyah);
  }
  // ── Lifecycle ─────────────────────────────────────────────────────────

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
      'layers-outline': layersOutline,
      'mic-outline': micOutline,
      'logo-whatsapp': logoWhatsapp,
      'radio-button-on-outline': radioButtonOnOutline,
      'folder-open-outline': folderOpenOutline,
      'stop-circle-outline': stopCircleOutline,
      'musical-notes-outline': musicalNotesOutline,
      'trash-outline': trashOutline,
      'mic-circle-outline': micCircleOutline,
      'help-circle-outline': helpCircleOutline,
    });
    this.surahs = await this.quranRepo.getAllSurahs();
    await this.loadUngradedHomework();
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  // ── Homework loading ──────────────────────────────────────────────────

  async loadUngradedHomework() {
    if (!this.student.id) return;
    const ungradedList = await this.homeworkRepo.findUngraded(this.student.id);
    if (ungradedList && ungradedList.length > 0) {
      this.ungradedHomework = ungradedList[0];
      this.ungradedHomeworkHizbLabel = await this.getThumunFromAya(
        this.ungradedHomework.start_surah,
        this.ungradedHomework.start_ayah,
        this.ungradedHomework.end_surah,
        this.ungradedHomework.end_ayah
      );
      await this.loadQuranPassage(this.ungradedHomework);
    } else {
      this.ungradedHomework = null;
      this.ungradedHomeworkHizbLabel = null;
      this.quranPassage = [];
      await this.prefillNextAssignment();
    }
  }

  async prefillNextAssignment() {
    if (!this.student.id) return;
    const hwList = await this.homeworkRepo.findByStudentId(this.student.id);
    const gradedList = hwList.filter((h) => h.graded_date !== null);

    if (gradedList.length > 0) {
      const lastHw = gradedList[0];

      let nextSurah = lastHw.end_surah;
      let nextAyah  = lastHw.end_ayah + 1;
      const maxVerses = this.getMaxAyahs(nextSurah);

      if (nextAyah > maxVerses) {
        nextSurah++;
        nextAyah = 1;
      }

      if (nextSurah <= 114) {
        this.newStartSurah = nextSurah;
        this.newStartAyah  = nextAyah;
        this.newEndSurah   = nextSurah;
      }
    }
  }

  // ── Ayah-mode handlers ───────────────────────────────────────────────

  onStartSurahChange() {
    if (this.newStartSurah && !this.newEndSurah) {
      this.newEndSurah = this.newStartSurah;
    }
  }

  // ── Hizb-mode handlers ───────────────────────────────────────────────

  onAssignModeChange() {
    this.hizbPreview = '';
    this.resolvedRange = null;
  }

  onDivisionCountChange() {
    // Reset subdivision index whenever the division size changes
    this.subdivisionIndex = 1;
    this.updateHizbPreview();
  }

  async updateHizbPreview() {
    if (!this.hizbNumber || this.hizbNumber < 1 || this.hizbNumber > 60) {
      this.hizbPreview = '';
      this.resolvedRange = null;
      return;
    }

    const range = await this.quranDivisionRepo.toAyahRange(
      this.hizbNumber,
      this.computedStartThumun,
      this.thumunCount,
    );

    if (!range) {
      this.hizbPreview = 'تعذّر تحميل البيانات';
      this.resolvedRange = null;
      return;
    }

    this.resolvedRange = range;

    const startSurahName = this.getSurahName(range.start_surah);
    const endSurahName   = this.getSurahName(range.end_surah);

    this.hizbPreview =
      `من سورة ${startSurahName} — آية ${range.start_ayah}` +
      `\nإلى سورة ${endSurahName} — آية ${range.end_ayah}`;
  }

  // ── Quran passage display ────────────────────────────────────────────

  toggleQuranPassage() {
    this.showQuranPassage = !this.showQuranPassage;
    if (this.showQuranPassage) this.currentPage = 1;
  }

  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage() { if (this.currentPage > 1) this.currentPage--; }

  async loadQuranPassage(hw: Homework) {
    this.quranPassage = await this.quranRepo.getAyahRange(
      hw.start_surah, hw.start_ayah, hw.end_surah, hw.end_ayah,
    );
  }

  // ── Utilities ────────────────────────────────────────────────────────

  getSurahName(surahId: number): string {
    const s = this.surahs.find((x) => x.id === surahId);
    return s ? s.name_arabic : String(surahId);
  }

  getMaxAyahs(surahId: number | null): number {
    if (!surahId) return 0;
    const s = this.surahs.find((x) => x.id === Number(surahId));
    return s ? s.verses_count : 0;
  }

  onAudioSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedAudioFile = file;
    } else {
      this.selectedAudioFile = null;
    }
  }

  async startRecording() {
    try {
      const permission = await VoiceRecorder.requestAudioRecordingPermission();
      if (!permission.value) {
        alert('يرجى منح صلاحية الميكروفون للتمكن من التسجيل.');
        return;
      }
      
      const result = await VoiceRecorder.startRecording();
      if (result.value) {
        this.isRecording = true;
        this.recordingTime = 0;
        this.recordingTimer = setInterval(() => {
          this.recordingTime++;
        }, 1000);
      } else {
        alert('تعذر بدء التسجيل.');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('حدث خطأ أثناء محاولة بدء التسجيل.');
    }
  }

  async stopRecording() {
    if (this.isRecording) {
      try {
        const result = await VoiceRecorder.stopRecording();
        this.isRecording = false;
        clearInterval(this.recordingTimer);
        
        if (result.value && result.value.recordDataBase64) {
          const mimeType = result.value.mimeType || 'audio/aac';
          const byteCharacters = atob(result.value.recordDataBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const audioBlob = new Blob([byteArray], { type: mimeType });
          
          const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'aac';
          this.selectedAudioFile = new File([audioBlob], `recording_${Date.now()}.${extension}`, { type: mimeType });
        }
      } catch (err) {
         console.error('Failed to stop recording', err);
      }
    }
  }

  clearAudio() {
    this.selectedAudioFile = null;
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let base64 = reader.result as string;
        base64 = base64.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  async sendHomeworkViaWhatsApp(startSurah: number, startAyah: number, endSurah: number, endAyah: number) {
    const startSurahName = this.getSurahName(startSurah);
    const endSurahName = this.getSurahName(endSurah);
    const hwText = `السلام عليكم،\nتم تعيين واجب جديد للطالب ${this.student.name}:\nمن سورة ${startSurahName} (آية ${startAyah})\nإلى سورة ${endSurahName} (آية ${endAyah})\n\nبالتوفيق!`;

    const phone = this.student.parent_contact;

    if (this.selectedAudioFile) {
      try {
        const base64 = await this.fileToBase64(this.selectedAudioFile);
        const fileName = `homework_${Date.now()}.m4a`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache
        });

        // Copy text to clipboard so they can paste it
        const textToCopy = phone ? String(phone) : hwText;
        await Clipboard.write({ string: textToCopy }).catch(() => {});

        await Share.share({
          title: 'الواجب الجديد',
          text: hwText, // Some apps use this, WhatsApp ignores it when url is present
          url: result.uri,
          dialogTitle: 'مشاركة الواجب'
        });
      } catch (err) {
        console.error('Error sharing audio file', err);
        alert('حدث خطأ أثناء مشاركة الملف الصوتي');
      }
    } else {
      if (phone) {
        window.open(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(hwText)}`, '_system');
      } else {
        await Share.share({
          title: 'الواجب الجديد',
          text: hwText,
          dialogTitle: 'مشاركة الواجب'
        });
      }
    }
  }

  async sendGradeViaWhatsApp() {
    if (!this.ungradedHomework) return;
    const phone = this.student.parent_contact;
    const gradeLabel = this.grades.find(g => g.key === this.gradeMark)?.value || this.gradeMark;
    
    let text = `السلام عليكم،\nتم تقييم تسميع الطالب ${this.student.name}:\nالتقييم: ${gradeLabel}\nعدد الأخطاء: ${this.mistakesCount}`;
    if (this.remark) {
      text += `\nملاحظات: ${this.remark}`;
    }

    if (phone) {
      window.open(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`, '_system');
    } else {
      await Share.share({
        title: 'تقييم التسميع',
        text: text,
      });
    }
  }

  // ── Form submissions ─────────────────────────────────────────────────

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

    // Update Mushaf progress for all Thumuns this homework overlaps
    await this.mushafProgressService.updateProgressAfterGrading(
      this.ungradedHomework.id
    );

    if (this.shareGradeViaWhatsapp) {
      await this.sendGradeViaWhatsApp();
    }

    await this.loadUngradedHomework();
    this.shareGradeViaWhatsapp = false;
    this.gradeMark = '';
    this.mistakesCount = 0;
    this.remark = '';
  }

  async assignNewHomework() {
    if (!this.student.id) return;

    let startSurah: number, startAyah: number, endSurah: number, endAyah: number;

    if (this.assignMode === 'hizb') {
      if (!this.hizbNumber || !this.resolvedRange) {
        alert('الرجاء اختيار رقم الحزب وانتظار تحميل النطاق.');
        return;
      }
      startSurah = this.resolvedRange.start_surah;
      startAyah  = this.resolvedRange.start_ayah;
      endSurah   = this.resolvedRange.end_surah;
      endAyah    = this.resolvedRange.end_ayah;
    } else {
      if (!this.newStartSurah || !this.newStartAyah || !this.newEndSurah || !this.newEndAyah) {
        alert('الرجاء ملء جميع حقول الواجب الجديد.');
        return;
      }
      startSurah = this.newStartSurah;
      startAyah  = this.newStartAyah;
      endSurah   = this.newEndSurah;
      endAyah    = this.newEndAyah;
    }

    try {
      await this.homeworkRepo.create({
        student_id: this.student.id,
        circle_id:  this.circleId,
        start_surah: startSurah,
        start_ayah:  startAyah,
        end_surah:   endSurah,
        end_ayah:    endAyah,
      });

      if (this.shareViaWhatsapp) {
        await this.sendHomeworkViaWhatsApp(startSurah, startAyah, endSurah, endAyah);
      }

      await this.loadUngradedHomework();
      
      // Reset optional fields
      this.selectedAudioFile = null;
      this.shareViaWhatsapp = false;
    } catch (err) {
      console.error('Failed to assign homework:', err);
    }
  }
}
