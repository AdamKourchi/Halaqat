import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonPopover,
  IonToggle,
} from '@ionic/angular/standalone';
import { TeacherRepository, ThemeService } from '@core';
import { MyCirclesComponent } from '../my-circles/my-circles.component';
import { SharedCirclesComponent } from '../shared-circles/shared-circles.component';
import { ModalController, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  settingsOutline,
  moonOutline,
  sunnyOutline,
} from 'ionicons/icons';
import { GlobalExtractModalComponent } from './components/global-extract-modal/global-extract-modal.component';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    MyCirclesComponent,
    SharedCirclesComponent,
    IonButtons,
    IonButton,
    IonIcon,
    IonPopover,
    IonToggle,
  ],
})
export class HomePage implements OnInit {
  segmentValue: 'mine' | 'shared' = 'mine';
  teacherCount = 0;
  isSettingsOpen = false;

  themeService = inject(ThemeService);
  private teacherRepo = inject(TeacherRepository);
  private cdr = inject(ChangeDetectorRef);
  private modalCtrl = inject(ModalController);

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
  }

  openSettings(event: Event) {
    this.isSettingsOpen = true;
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  async openGlobalExtractModal() {
    const modal = await this.modalCtrl.create({
      component: GlobalExtractModalComponent
    });
    await modal.present();
  }

  async ngOnInit() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'settings-outline': settingsOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline,
    });
    this.teacherCount = await this.teacherRepo.count();
    this.cdr.detectChanges();
  }
}
