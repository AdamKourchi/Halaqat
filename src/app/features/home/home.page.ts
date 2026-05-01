import { Component, inject, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
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
  IonFooter,
  IonTabBar,
  IonTabButton
} from '@ionic/angular/standalone';
import { TeacherRepository, ThemeService } from '@core';
import { MyCirclesComponent } from '../my-circles/my-circles.component';
import { SharedCirclesComponent } from '../shared-circles/shared-circles.component';
import { ModalController, IonButtons, IonButton, IonIcon} from '@ionic/angular/standalone';
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
    IonFooter,
    IonTabBar,
    IonTabButton
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

  // Grab a reference to the child component
  @ViewChild(MyCirclesComponent) myCirclesComponent!: MyCirclesComponent;
  @ViewChild(SharedCirclesComponent) sharedCirclesComponent!: SharedCirclesComponent;

  // Track the state for the UI
  isSelectionActive = false;
  selectedCount = 0;

  // Listen to the child
  onSelectionStateChange(state: { isActive: boolean; count: number }) {
    this.isSelectionActive = state.isActive;
    this.selectedCount = state.count;
  }

  // Footer Button Actions (These just pass the command down to the child)
  triggerDelete() { this.myCirclesComponent?.deleteSelected(); }
  triggerSummary() { this.myCirclesComponent?.extractSummary(); }
  triggerShare() { this.myCirclesComponent?.shareSelected(); }
  triggerEdit() { this.myCirclesComponent?.editSelected(); }
  triggerCancel() { this.myCirclesComponent?.cancelSelection(); }

  triggerDeleteShared() { this.sharedCirclesComponent?.deleteSelected(); }
  triggerSummaryShared() { this.sharedCirclesComponent?.extractSummary(); }
  triggerShareShared() { this.sharedCirclesComponent?.shareSelected(); }
  triggerCancelShared() { this.sharedCirclesComponent?.cancelSelection(); }

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
