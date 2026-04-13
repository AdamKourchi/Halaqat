import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  saveOutline,
  trashOutline,
  documentTextOutline,
  createOutline,
} from 'ionicons/icons';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonDatetime,
  AlertController,
  ToastController,
  IonModal,
  IonDatetimeButton,
  IonBadge, IonFooter } from '@ionic/angular/standalone';
import {
  StudentRepository,
  HomeworkRepository,
  ExcelService,
  Student,
  Homework,
} from '@core';

@Component({
  selector: 'app-student-profile',
  templateUrl: './student-profile.component.html',
  styleUrls: ['./student-profile.component.scss'],
  standalone: true,
  imports: [IonFooter, 
    IonBadge,
    IonDatetimeButton,
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonDatetime,
    IonModal,
  ],
})
export class StudentProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  studentId = Number(this.route.snapshot.paramMap.get('id'));
  student: Student | null = null;
  homeworks: Homework[] = [];

  // Date range for Excel export
  startDate: string = new Date(
    new Date().setMonth(new Date().getMonth() - 1),
  ).toISOString();
  endDate: string = new Date().toISOString();

  ngOnInit() {
    addIcons({
      'arrow-back': arrowBackOutline,
      save: saveOutline,
      trash: trashOutline,
      'document-text': documentTextOutline,
      create: createOutline,
    });
    this.loadData();
  }

  async loadData() {
    if (this.studentId) {
      this.student = await this.studentRepo.findById(this.studentId);
      this.homeworks = await this.homeworkRepo.findByStudentId(this.studentId);
    }
  }

  async saveStudent() {
    if (!this.student || !this.student.id) return;
    try {
      await this.studentRepo.update(this.student.id, {
        name: this.student.name,
        gender: this.student.gender,
        parent_name: this.student.parent_name,
        parent_contact: this.student.parent_contact,
      });
      const toast = await this.toastCtrl.create({
        message: 'تم حفظ بيانات الطالب',
        duration: 2000,
        color: 'success',
      });
      toast.present();
    } catch (e) {
      console.error(e);
    }
  }

  async confirmDeleteStudent() {
    const alert = await this.alertCtrl.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف هذا الطالب وجميع واجباته؟',
      buttons: [
        { text: 'إلغاء', role: 'cancel' },
        {
          text: 'حذف',
          role: 'destructive',
          handler: () => this.deleteStudent(),
        },
      ],
    });
    await alert.present();
  }

  async deleteStudent() {
    if (!this.student || !this.student.id) return;
    try {
      // First delete all homeworks (if cascade is not enabled)
      for (const hw of this.homeworks) {
        if (hw.id) await this.homeworkRepo.delete(hw.id);
      }
      await this.studentRepo.delete(this.student.id);
      this.router.navigate(['/circle-details', this.student.circle_id]);
    } catch (e) {
      console.error(e);
    }
  }

  async deleteHomework(hw: Homework) {
    if (!hw.id) return;
    const alert = await this.alertCtrl.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف هذا الواجب؟',
      buttons: [
        { text: 'إلغاء', role: 'cancel' },
        {
          text: 'حذف',
          role: 'destructive',
          handler: async () => {
            if (hw.id) {
              await this.homeworkRepo.delete(hw.id);
              this.loadData();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async generateExcel() {
    if (!this.student) return;
    // Filter homeworks by selected date range
    const start = new Date(this.startDate).getTime();
    // Set end to end of day
    const endObj = new Date(this.endDate);
    endObj.setHours(23, 59, 59, 999);
    const end = endObj.getTime();

    const filtered = this.homeworks.filter((h) => {
      const d = new Date(h.date_assigned!).getTime();
      return d >= start && d <= end;
    });

    if (filtered.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'لا توجد واجبات في هذه الفترة',
        duration: 2000,
        color: 'warning',
      });
      toast.present();
      return;
    }

    try {
      await this.excelService.generateStudentExcel(this.student, filtered);
    } catch (e) {
      console.error(e);
      const toast = await this.toastCtrl.create({
        message: 'حدث خطأ أثناء إنشاء التقرير' + e,
        duration: 2000,
        color: 'danger',
      });
      toast.present();
    }
  }

  back() {
    if (this.student && this.student.circle_id) {
      this.router.navigate(['/circle-details', this.student.circle_id]);
    } else {
      this.router.navigate(['/home']);
    }
  }
}
