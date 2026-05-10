import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonLabel,
  IonItem,
  IonSegment,
  IonSegmentButton,
  ModalController,
  ToastController,
  IonChip,
  IonTextarea
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import {  MessageTemplatesRepository } from '@core';

@Component({
  selector: 'app-text-customization-modal',
  templateUrl: './text-customization-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonItem,
    IonChip,
    IonTextarea,
    IonSegment,
    IonSegmentButton
],
})
export class TextCustomizationModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private readonly messageService = inject(MessageTemplatesRepository);
  private readonly toastCtrl = inject(ToastController);

  @ViewChild('messageInput', { static: false }) messageInput!: IonTextarea;

  selectedType: 'grading' | 'assignment' = 'assignment';

  templateContent: string = '';

  constructor() {
    addIcons({ close });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async segmentChanged(event: any) {
    this.selectedType = event.detail.value;
    await this.loadData();
  }

  async insertVariable(variable: string) {
    const nativeEl = await this.messageInput.getInputElement();
    const start = nativeEl.selectionStart;
    const end = nativeEl.selectionEnd;
    const text = this.templateContent;
    this.templateContent =
      text.substring(0, start) + variable + text.substring(end);
    setTimeout(() => {
      nativeEl.focus();
      const newCursorPos = start + variable.length;
      nativeEl.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }


  async loadData(){
    const template = await this.messageService.getMessageTemplate(this.selectedType);
    if (template) {
      this.templateContent = template.content;
    } else {
      // Load fallback text if empty
      this.templateContent = await this.messageService.generateWhatsAppMessage(this.selectedType, {});
    }
  }

  async saveTemplate() {
    await this.messageService.saveMessageTemplate(this.templateContent, this.selectedType);
    const toast = await this.toastCtrl.create({
      message: 'تم حفظ نموذج الرسالة بنجاح',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
