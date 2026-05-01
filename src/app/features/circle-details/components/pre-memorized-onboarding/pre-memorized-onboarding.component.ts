import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButton, IonIcon, IonButtons, IonItem, IonLabel,
  IonInput, IonCheckbox,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, checkmarkCircle, bookOutline, addCircleOutline, removeCircleOutline } from 'ionicons/icons';
import { MushafProgressService } from '@core';

interface ThumunSelection {
  hizb_number: number;
  thumun_number: number;
  selected: boolean;
}

interface HizbRow {
  hizb_number: number;
  thumuns: ThumunSelection[];
  expanded: boolean;
  allSelected: boolean;
}

@Component({
  standalone: true,
  selector: 'app-pre-memorized-onboarding',
  templateUrl: './pre-memorized-onboarding.component.html',
  styleUrls: ['./pre-memorized-onboarding.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonButton, IonIcon, IonButtons, IonItem,
    IonInput, IonCheckbox,
  ],
})
export class PreMemorizedOnboardingComponent implements OnInit {
  /** Present when called from the student profile page (immediate persist). */
  @Input() studentId?: string;
  @Input() circleId?: string;

  private modalCtrl   = inject(ModalController);
  private toastCtrl   = inject(ToastController);
  private progressSvc = inject(MushafProgressService);

  saving = false;

  /** Quick Hizb range entry */
  fromHizb: number | null = null;
  toHizb: number | null   = null;

  hizbRows: HizbRow[] = [];

  get selectedCount(): number {
    return this.hizbRows.reduce(
      (s, h) => s + h.thumuns.filter((t) => t.selected).length, 0
    );
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    addIcons({ close, checkmarkCircle, bookOutline, addCircleOutline, removeCircleOutline });
    this.buildRows();
  }

  private buildRows() {
    this.hizbRows = Array.from({ length: 60 }, (_, i) => ({
      hizb_number: i + 1,
      expanded:    false,
      allSelected: false,
      thumuns: Array.from({ length: 8 }, (__, j) => ({
        hizb_number:   i + 1,
        thumun_number: j + 1,
        selected:      false,
      })),
    }));
  }

  // ── Quick-select range ───────────────────────────────────────────────────

  /** Select all Thumuns in the range [fromHizb, toHizb] inclusive. */
  applyQuickRange() {
    if (!this.fromHizb || !this.toHizb) return;
    const from = Math.max(1, Math.min(60, this.fromHizb));
    const to   = Math.max(from, Math.min(60, this.toHizb));

    for (const row of this.hizbRows) {
      if (row.hizb_number >= from && row.hizb_number <= to) {
        row.thumuns.forEach((t) => (t.selected = true));
        row.allSelected = true;
      }
    }
  }

  clearAll() {
    this.hizbRows.forEach((row) => {
      row.thumuns.forEach((t) => (t.selected = false));
      row.allSelected = false;
    });
    this.fromHizb = null;
    this.toHizb   = null;
  }

  // ── Per-Hizb toggle ──────────────────────────────────────────────────────

  toggleHizbAll(row: HizbRow) {
    const target = !row.allSelected;
    row.thumuns.forEach((t) => (t.selected = target));
    row.allSelected = target;
  }

  onThumunToggle(row: HizbRow) {
    row.allSelected = row.thumuns.every((t) => t.selected);
  }

  hasSomeSelected(row: HizbRow): boolean {
    return row.thumuns.some((t) => t.selected);
  }

  toggleExpand(row: HizbRow) {
    row.expanded = !row.expanded;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async save() {
    const allThumuns: ThumunSelection[] = this.hizbRows.reduce(
      (acc: ThumunSelection[], r: HizbRow) => acc.concat(r.thumuns),
      []
    );
    const selected = allThumuns
      .filter((t: ThumunSelection) => t.selected)
      .map((t: ThumunSelection) => ({ hizb_number: t.hizb_number, thumun_number: t.thumun_number }));

    if (selected.length === 0) {
      this.showToast('لم تحدد أي ثُمن بعد.', 'warning');
      return;
    }

    // ── Deferred mode: caller will persist after the student is created ──
    if (!this.studentId) {
      this.modalCtrl.dismiss({ thumuns: selected });
      return;
    }

    // ── Immediate mode: student already exists, write to DB now ──────────
    this.saving = true;
    try {
      await this.progressSvc.onboardPreMemorized(
        this.studentId, this.circleId ?? '', selected
      );
      this.showToast(`تم حفظ ${selected.length} ثُمن كحفظ سابق ✔`, 'success');
      this.modalCtrl.dismiss({ saved: true });
    } catch (e) {
      console.error(e);
      this.showToast('حدث خطأ أثناء الحفظ', 'danger');
    } finally {
      this.saving = false;
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  private async showToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color });
    t.present();
  }
}
