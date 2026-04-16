import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeacherRepository } from '@core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonInput,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
  ],
})
export class RegisterComponent implements OnInit {
  name = '';
  private router = inject(Router);
  private teacherRepo = inject(TeacherRepository);


  constructor() {}

  ngOnInit() {}

  register() {
    try {
      this.teacherRepo.create(null,this.name, '123456', true);
    } catch (error) {
      console.log(error);
    }finally{
      this.router.navigate(['/home']);
    }
  }

  goToLogin() {
    console.log('Going to login...');
  }

  canRegister() {
    return (
      this.name.length > 0
    );
  }
}
