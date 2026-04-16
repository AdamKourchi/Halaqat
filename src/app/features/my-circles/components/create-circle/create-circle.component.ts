import { Component, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular/standalone';

@Component({
  selector: 'app-create-circle',
  templateUrl: './create-circle.component.html',
  styleUrls: ['./create-circle.component.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonInput, FormsModule, IonSelect, IonSelectOption]
})
export class CreateCircleComponent {
  private modalCtrl = inject(ModalController);
  @Input() circleName = '';  
  @Input() circleType = '';
  @Input() isEdit = false;

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    return this.modalCtrl.dismiss({ name: this.circleName, type: this.circleType }, 'confirm');
  }
}
