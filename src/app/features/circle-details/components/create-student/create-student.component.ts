import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonInput, IonSelect, IonSelectOption } from '@ionic/angular/standalone';

@Component({
  selector: 'app-create-student',
  templateUrl: './create-student.component.html',
  styleUrls: ['./create-student.component.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonInput, FormsModule, IonSelect, IonSelectOption]
})
export class CreateStudentComponent {
  private modalCtrl = inject(ModalController);
  
  studentName = '';  
  studentGender = 'Male';
  parentName = '';
  parentContact = '';

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    return this.modalCtrl.dismiss({ 
      name: this.studentName, 
      gender: this.studentGender,
      parent_name: this.parentName,
      parent_contact: this.parentContact
    }, 'confirm');
  }
}
