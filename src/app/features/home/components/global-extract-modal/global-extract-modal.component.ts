import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonCheckbox,
  IonInput,
  ModalController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, documentText } from 'ionicons/icons';
import {
  CircleRepository,
  StudentRepository,
  HomeworkRepository,
  ExcelService,
  Circle,
  TeacherRepository,
  Teacher,
} from '@core';

@Component({
  selector: 'app-global-extract-modal',
  templateUrl: './global-extract-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonListHeader,
    IonLabel,
    IonItem,
    IonCheckbox,
    IonInput,
  ],
})
export class GlobalExtractModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private circleRepo = inject(CircleRepository);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private alertCtrl = inject(AlertController);
  private teacherRepo = inject(TeacherRepository);

  ownedCircles: Circle[] = [];
  sharedCircles: Circle[] = [];
  teachers: Teacher[] = [];

  selectedCircleIds = new Set<string>();

  startDate: string = new Date(new Date().setMonth(new Date().getMonth() - 1))
    .toISOString()
    .split('T')[0];
  endDate: string = new Date().toISOString().split('T')[0];

  async ngOnInit() {
    addIcons({ close, 'document-text': documentText });
    this.ownedCircles = await this.circleRepo.findOwnerCircles();
    this.sharedCircles = await this.circleRepo.findAllSharedCircles();
    this.fetchTeachers();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  toggleCircle(circleId: string) {
    if (this.selectedCircleIds.has(circleId)) {
      this.selectedCircleIds.delete(circleId);
    } else {
      this.selectedCircleIds.add(circleId);
    }
  }

  toggleAll(circles: Circle[]) {
    const allSelected = circles.every(
      (c) => c.id && this.selectedCircleIds.has(c.id)
    );
    for (const c of circles) {
      if (c.id) {
        if (allSelected) {
          this.selectedCircleIds.delete(c.id);
        } else {
          this.selectedCircleIds.add(c.id);
        }
      }
    }
  }

  async generateReport() {
    if (this.selectedCircleIds.size === 0) {
      const alert = await this.alertCtrl.create({
        header: 'تنبيه',
        message: 'الرجاء تحديد حلقة واحدة على الأقل.',
        buttons: ['حسنا'],
      });
      await alert.present();
      return;
    }

    if (!this.startDate || !this.endDate) {
      const alert = await this.alertCtrl.create({
        header: 'تنبيه',
        message: 'الرجاء تحديد فترة التقرير.',
        buttons: ['حسنا'],
      });
      await alert.present();
      return;
    }

    const allStudents: any[] = [];
    const allHomeworks: any[] = [];

    for (const circleId of this.selectedCircleIds) {
      const students = await this.studentRepo.findByCircleId(circleId);
      allStudents.push(...students);
      for (const st of students) {
        if (st.id) {
          const hws = await this.homeworkRepo.findByStudentId(st.id);
          allHomeworks.push(...hws);
        }
      }
    }

    const start = new Date(this.startDate).getTime();
    const endObj = new Date(this.endDate);
    endObj.setHours(23, 59, 59, 999);
    const end = endObj.getTime();

    const filteredHomeworks = allHomeworks.filter((h) => {
      const d = new Date(h.date_assigned!).getTime();
      return d >= start && d <= end;
    });

    if (this.selectedCircleIds.size === 1) {
      await this.excelService.generateCircleExcel(
        allStudents,
        filteredHomeworks
      );
    } else {
      await this.excelService.generateMultipleCirclesExcel(
        allStudents,
        filteredHomeworks
      );
    }

    this.dismiss();
  }
  async fetchTeachers() {
    try {
      this.teachers = await this.teacherRepo.findAll();
    } catch (error) {
      console.log(error);
    }
  }
  findTeacherName(id:any){
    return this.teachers.find((t) => t.id === id)?.name;
  }
}
