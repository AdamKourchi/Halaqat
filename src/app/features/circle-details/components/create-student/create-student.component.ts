import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ModalController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonBadge,
} from '@ionic/angular/standalone';
import { PreMemorizedOnboardingComponent } from '../pre-memorized-onboarding/pre-memorized-onboarding.component';
import { addIcons } from 'ionicons';
import { bookOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-create-student',
  templateUrl: './create-student.component.html',
  styleUrls: ['./create-student.component.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    FormsModule,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonBadge,
  ],
})
export class CreateStudentComponent implements OnInit {
  private modalCtrl = inject(ModalController);

  studentName    = '';
  studentGender  = 'Male';
  parentName     = '';
  parentContact  = '';
  medicalIssues  = '';

  /** Thumuns selected in the pre-memorized modal (deferred – no studentId yet). */
  preMemorizedThumuns: Array<{ hizb_number: number; thumun_number: number }> = [];

  ngOnInit() {
    addIcons({ book: bookOutline, close: closeOutline });
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    return this.modalCtrl.dismiss(
      {
        name:                  this.studentName,
        gender:                this.studentGender,
        parent_name:           this.parentName,
        parent_contact:        this.parentContact,
        medical_issues:        this.medicalIssues,
        pre_memorized_thumuns: this.preMemorizedThumuns,
      },
      'confirm'
    );
  }

  /** Open the pre-memorized onboarding modal in deferred mode (no studentId). */
  async openOnboardingModal() {
    const modal = await this.modalCtrl.create({
      component: PreMemorizedOnboardingComponent,
      // No studentId → deferred mode: modal just returns the selection
      breakpoints:       [0, 0.85, 1],
      initialBreakpoint: 0.85,
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.thumuns?.length) {
      this.preMemorizedThumuns = data.thumuns;
    }
  }
}
