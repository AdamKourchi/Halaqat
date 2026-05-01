import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { IonIcon, IonButton, AlertController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bookOutline,
  chevronDownOutline,
  timeOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  refreshOutline,
} from 'ionicons/icons';

import { MushafProgressService } from '@core';
import { HizbProgressVM, ThumunProgressVM, DecayStatus } from '@core';

interface ThumunSlot {
  index: number;   // 1–8
  vm: ThumunProgressVM | null;
}

const RING_RADIUS = 32;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

@Component({
  standalone: true,
  selector: 'app-mushaf-visualizer',
  templateUrl: './mushaf-visualizer.component.html',
  styleUrls: ['./mushaf-visualizer.component.scss'],
  imports: [CommonModule, DecimalPipe, IonIcon, IonButton],
})
export class MushafVisualizerComponent implements OnInit, OnChanges {
  @Input() studentId!: string;

  private mushafProgressService = inject(MushafProgressService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  // ── State ────────────────────────────────────────────────────────────────
  loading          = true;
  hizbVMs: HizbProgressVM[]  = [];
  overallPct       = 0;
  totalThumunsMemorized = 0;

  /** Which Hizb cards are expanded. */
  expandedHizbs = new Set<number>();

  /** Currently selected Thumun for the detail popover. */
  selectedThumun: ThumunProgressVM | null = null;

  // ── Ring chart ───────────────────────────────────────────────────────────
  readonly ringCircumference = RING_CIRCUMFERENCE;

  get ringOffset(): number {
    const fraction = this.overallPct / 100;
    return RING_CIRCUMFERENCE * (1 - fraction);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    addIcons({
      'book-outline':             bookOutline,
      'chevron-down-outline':     chevronDownOutline,
      'time-outline':             timeOutline,
      'alert-circle-outline':     alertCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'refresh-outline':          refreshOutline,
    });
    this.load();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['studentId'] && !changes['studentId'].firstChange) {
      this.load();
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  async load() {
    if (!this.studentId) return;
    this.loading = true;
    try {
      const { hizbs, overallPct } =
        await this.mushafProgressService.getStudentProgressVM(this.studentId);
      this.hizbVMs   = hizbs;
      this.overallPct = overallPct;
      this.totalThumunsMemorized = hizbs.reduce(
        (s, h) => s + h.memorized_count, 0
      );
    } finally {
      this.loading = false;
    }
  }

  /** Reload externally (called by parent after grading or onboarding). */
  async refresh() {
    await this.load();
  }

  async recalculateProgress() {
    const alert = await this.alertCtrl.create({
      header: 'إعادة حساب التقدم',
      message: 'سيتم إعادة حساب جميع تقدم الطالب بناءً على التقييمات الحالية. هل أنت متأكد؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
        },
        {
          text: 'إعادة حساب',
          role: 'confirm',
          handler: async () => {
            this.loading = true;
            try {
              await this.mushafProgressService.recalculateAllProgress(this.studentId);
              await this.load();
              const toast = await this.toastCtrl.create({
                message: 'تم إعادة الحساب بنجاح',
                duration: 2000,
                color: 'success',
                position: 'top',
              });
              toast.present();
            } catch (e) {
              const toast = await this.toastCtrl.create({
                message: 'حدث خطأ أثناء إعادة الحساب',
                duration: 2000,
                color: 'danger',
                position: 'top',
              });
              toast.present();
              this.loading = false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns all 8 slots for a Hizb, filling in null for unmemoized Thumuns.
   */
  allEightThumuns(hizb: HizbProgressVM): ThumunSlot[] {
    const slots: ThumunSlot[] = [];
    for (let i = 1; i <= 8; i++) {
      const vm = hizb.thumuns.find((t) => t.thumun_number === i) ?? null;
      slots.push({ index: i, vm });
    }
    return slots;
  }

  toggleHizb(hizbNumber: number) {
    if (this.expandedHizbs.has(hizbNumber)) {
      this.expandedHizbs.delete(hizbNumber);
    } else {
      this.expandedHizbs.add(hizbNumber);
    }
  }

  openThumunDetail(thumun: ThumunProgressVM) {
    this.selectedThumun = thumun;
  }

  closeThumunDetail() {
    this.selectedThumun = null;
  }

  scoreLabel(score: number): string {
    return this.mushafProgressService.scoreLabel(score);
  }

  decayLabel(status: DecayStatus): string {
    const map: Record<DecayStatus, string> = {
      fresh: 'مراجَع حديثاً',
      aging: 'يقترب موعد المراجعة',
      due:   'يحتاج مراجعة!',
    };
    return map[status];
  }

  decayIcon(status: DecayStatus): string {
    const map: Record<DecayStatus, string> = {
      fresh: 'checkmark-circle-outline',
      aging: 'time-outline',
      due:   'alert-circle-outline',
    };
    return map[status];
  }
}
