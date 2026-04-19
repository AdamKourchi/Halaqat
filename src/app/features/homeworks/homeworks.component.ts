import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  Student,
  Homework,
  StudentRepository,
  HomeworkRepository,
  QuranRepository,
  GradingMarksHelper
} from '@core';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import { trashOutline, arrowForwardOutline } from 'ionicons/icons';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-homeworks',
  templateUrl: './homeworks.component.html',
  styleUrls: ['./homeworks.component.scss'],
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
  ],
})
export class HomeworksComponent implements OnInit {
  constructor() {}
  student: Student | null = null;
  homeworks: Homework[] = [];

  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private alertCtrl = inject(AlertController);
  private route = inject(ActivatedRoute);
  private quranRepo = inject(QuranRepository);

  studentId: string | null = null;
  surahs : string[] = [];
  circleId: string | undefined;
  gradingMarksHelper = inject(GradingMarksHelper);

  async loadData() {
    if (this.studentId) {
      this.student = await this.studentRepo.findById(this.studentId);
      this.homeworks = await this.homeworkRepo.findByStudentId(this.studentId);
      this.circleId = this.student?.circle_id;
    }
  }

   getSurahName(id: number) {
    return this.surahs[id-1];
  }

  async loadSurahsNames(){
    const surahs = await this.quranRepo.getAllSurahs();
    this.surahs = surahs.map(s => s.name_arabic);
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

  ngOnInit() {
    addIcons({
      trash: trashOutline,
      arrowForward: arrowForwardOutline,
    });
    this.studentId = this.route.snapshot.paramMap.get('id');
    this.loadData();
    this.loadSurahsNames();
  }
}
