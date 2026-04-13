import { Component, OnInit, inject } from '@angular/core';
import {
  IonCard,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  AlertController,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import {
  CircleRepository,
  UserRepository,
  StudentRepository,
  HomeworkRepository,
  ExcelService,
  User,
  Circle,
} from '@core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-shared-circles',
  templateUrl: './shared-circles.component.html',
  styleUrls: ['./shared-circles.component.scss'],
  standalone: true,
  imports: [
    IonIcon,
    IonButton,
    IonCard,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
  ],
})
export class SharedCirclesComponent implements OnInit {
  constructor() {}
  private circleRepo = inject(CircleRepository);
  private userRepo = inject(UserRepository);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);

  circles: Circle[] = [];
  user: User | null = null;

  selectionMode = false;
  selectedCircles: Set<number> = new Set();
  private pressTimer: any;
  private longPressActive = false;

  async fetchSharedCircles() {
    try {
      this.circles = await this.circleRepo.findAllSharedCircles();
    } catch (error) {
      console.error(error);
    }
  }

  async fetchUserData() {
    try {
      const users = await this.userRepo.findByRole('USER');
      this.user = users[0];
    } catch (error) {
      console.log(error);
    }
  }

  startPress(circle: Circle) {
    this.longPressActive = false;
    this.pressTimer = setTimeout(() => {
      this.longPressActive = true;
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      this.enableSelectionMode(circle);
    }, 600);
  }

  endPress() {
    clearTimeout(this.pressTimer);
  }

  enableSelectionMode(circle: Circle) {
    if (!circle.id) return;
    this.selectionMode = true;
    if (!this.selectedCircles.has(circle.id)) {
      this.selectedCircles.add(circle.id);
    }
  }

  toggleSelection(circle: Circle) {
    if (!circle.id) return;
    if (this.selectedCircles.has(circle.id)) {
      this.selectedCircles.delete(circle.id);
      if (this.selectedCircles.size === 0) {
        this.selectionMode = false;
      }
    } else {
      this.selectedCircles.add(circle.id);
    }
  }

  onCardClick(circle: Circle) {
    if (this.longPressActive) {
      return;
    }
    if (this.selectionMode) {
      this.toggleSelection(circle);
    } else {
      this.router.navigate(['/circle-details', circle.id]);
    }
  }

  cancelSelection() {
    this.selectionMode = false;
    this.selectedCircles.clear();
  }

  deleteSelected() {
    try {
      for (const circleId of this.selectedCircles) {
        this.circleRepo.delete(circleId);
      }
    } catch (error) {
      console.log(error);
    } finally {
      this.fetchSharedCircles();
    }
    this.cancelSelection();
  }

  shareSelected() {
    console.log('Share logic for', Array.from(this.selectedCircles));
    // TODO: implement share logic
  }

  async importCircle() {
   console.log("IMPORTING ...");
   
  }

  async extractSummary() {
    if (this.selectedCircles.size === 0) return;
    const alert = await this.alertCtrl.create({
      header: 'تحديد فترة التقرير لتلك الحلقات',
      inputs: [
        {
          name: 'startDate',
          type: 'date',
          placeholder: 'من تاريخ',
          value: new Date(new Date().setMonth(new Date().getMonth() - 1))
            .toISOString()
            .split('T')[0],
        },
        {
          name: 'endDate',
          type: 'date',
          placeholder: 'إلى تاريخ',
          value: new Date().toISOString().split('T')[0],
        },
      ],
      buttons: [
        { text: 'إلغاء', role: 'cancel' },
        {
          text: 'إنشاء التقرير',
          handler: async (data) => {
            if (data.startDate && data.endDate) {
              const allStudents: any[] = [];
              const allHomeworks: any[] = [];

              for (const circleId of this.selectedCircles) {
                const students =
                  await this.studentRepo.findByCircleId(circleId);
                allStudents.push(...students);
                for (const st of students) {
                  if (st.id) {
                    const hws = await this.homeworkRepo.findByStudentId(st.id);
                    allHomeworks.push(...hws);
                  }
                }
              }

              const start = new Date(data.startDate).getTime();
              const endObj = new Date(data.endDate);
              endObj.setHours(23, 59, 59, 999);
              const end = endObj.getTime();

              const filteredHomeworks = allHomeworks.filter((h) => {
                const d = new Date(h.date_assigned!).getTime();
                return d >= start && d <= end;
              });

              if (this.selectedCircles.size === 1) {
                await this.excelService.generateCircleExcel(
                  allStudents,
                  filteredHomeworks,
                );
              } else {
                await this.excelService.generateMultipleCirclesExcel(
                  allStudents,
                  filteredHomeworks,
                );
              }
            }
          },
        },
      ],
    });
    await alert.present();
  }
  ngOnInit() {
    this.fetchSharedCircles();
    this.fetchUserData();
  }
}
