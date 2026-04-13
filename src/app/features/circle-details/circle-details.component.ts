import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  Circle,
  Student,
  User,
  CircleRepository,
  UserRepository,
  StudentRepository,
  HomeworkRepository,
  ExcelService
} from '@core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  ModalController,
  AlertController,
  IonBadge,
  IonSegment,
  IonSegmentButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  add,
  trash,
  shareSocial,
  documentText,
  close,
} from 'ionicons/icons';
import { CreateStudentComponent } from './components/create-student/create-student.component';
import { StudentHomeworkComponent } from './components/student-homework/student-homework.component';

@Component({
  standalone: true,
  imports: [
    IonBadge,
    IonCardContent,
    IonCardSubtitle,
    IonCardTitle,
    IonCardHeader,
    IonCard,
    IonIcon,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton
  ],
  selector: 'app-circle-details',
  templateUrl: './circle-details.component.html',
  styleUrls: ['./circle-details.component.scss'],
})
export class CircleDetailsComponent implements OnInit {
  constructor() {}
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private circleRepo = inject(CircleRepository);
  private userRepo = inject(UserRepository);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);

  circleId = Number(this.route.snapshot.paramMap.get('id'));
  circle: Circle | null = null;
  user: User | null = null;
  students: Student[] = [];

  selectionMode = false;
  selectedStudents: Set<number> = new Set();
  private pressTimer: any;
  private longPressActive = false;

  async fetchUser() {
    try {
      const users = await this.userRepo.findByRole('USER');
      this.user = users[0];
    } catch (error) {
      console.log(error);
    }
  }

  async fetchCircle() {
    try {
      const circle = await this.circleRepo.findById(this.circleId!);
      this.circle = circle;
    } catch (error) {
      console.log(error);
    }
  }

  async fetchStudents() {
    try {
      const students = await this.studentRepo.findByCircleId(this.circle?.id!);
      this.students = students;
    } catch (error) {
      console.log(error);
    }
  }

  async openCreateStudentModal() {
    const modal = await this.modalCtrl.create({
      component: CreateStudentComponent,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      try {
        if (this.circle && this.circle.id !== undefined) {
          await this.studentRepo.create(
            this.circle.id,
            data.name,
            data.gender,
            data.parent_name,
            data.parent_contact,
          );
        }
      } catch (error) {
        console.log(error);
      } finally {
        this.fetchStudents();
      }
    }
  }

  startPress(student: Student) {
    this.longPressActive = false;
    this.pressTimer = setTimeout(() => {
      this.longPressActive = true;
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      this.enableSelectionMode(student);
    }, 600);
  }

  endPress() {
    clearTimeout(this.pressTimer);
  }

  enableSelectionMode(student: Student) {
    if (!student.id) return;
    this.selectionMode = true;
    if (!this.selectedStudents.has(student.id)) {
      this.selectedStudents.add(student.id);
    }
  }

  toggleSelection(student: Student) {
    if (!student.id) return;
    if (this.selectedStudents.has(student.id)) {
      this.selectedStudents.delete(student.id);
      if (this.selectedStudents.size === 0) {
        this.selectionMode = false;
      }
    } else {
      this.selectedStudents.add(student.id);
    }
  }

  onCardClick(student: Student) {
    if (this.longPressActive) {
      return;
    }
    if (this.selectionMode) {
      this.toggleSelection(student);
    } else {
      this.openStudentHomeworkModal(student);
    }
  }

  cancelSelection() {
    this.selectionMode = false;
    this.selectedStudents.clear();
  }

  deleteSelected() {
    try {
      for (const studentId of this.selectedStudents) {
        this.studentRepo.delete(studentId);
      }
    } catch (error) {
      console.log(error);
    } finally {
      this.fetchStudents();
    }
    this.cancelSelection();
  }

  shareSelected() {
    console.log('Share logic for students', Array.from(this.selectedStudents));
  }

  async extractSummary() {
    if (this.selectedStudents.size === 1) {
      const id = Array.from(this.selectedStudents)[0];
      this.router.navigate(['/student-profile', id]);
    } else {
      const alert = await this.alertCtrl.create({
        header: 'تحديد فترة التقرير',
        inputs: [
          {
            name: 'startDate',
            type: 'date',
            placeholder: 'من تاريخ',
            value: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
          },
          {
            name: 'endDate',
            type: 'date',
            placeholder: 'إلى تاريخ',
            value: new Date().toISOString().split('T')[0]
          }
        ],
        buttons: [
          { text: 'إلغاء', role: 'cancel' },
          {
            text: 'إنشاء التقرير',
            handler: async (data) => {
              if (data.startDate && data.endDate) {
                const studentsList = this.students.filter(s => s.id && this.selectedStudents.has(s.id));
                const allHomeworks: any[] = [];
                for (const student of studentsList) {
                  const hws = await this.homeworkRepo.findByStudentId(student.id!);
                  allHomeworks.push(...hws);
                }
                const start = new Date(data.startDate).getTime();
                const endObj = new Date(data.endDate);
                endObj.setHours(23, 59, 59, 999);
                const end = endObj.getTime();
                
                const filteredHomeworks = allHomeworks.filter(h => {
                  const d = new Date(h.date_assigned!).getTime();
                  return d >= start && d <= end;
                });
                
                await this.excelService.generateCircleExcel(studentsList, filteredHomeworks);
              }
            }
          }
        ]
      });
      await alert.present();
    }
  }

  back() {
    this.router.navigate(['/home']);
  }

  async ngOnInit() {
    addIcons({
      'arrow-back': arrowBackOutline,
      add,
      trash,
      'share-social': shareSocial,
      'document-text': documentText,
      close,
    });
    await this.fetchCircle();
    this.fetchUser();
    this.fetchStudents();
  }

  // Filter state
  filterType: 'all' | 'Male' | 'Female' | 'graded_today' | 'not_graded' | 'no_homework' = 'all';

  get filteredStudents(): Student[] {
    return this.students.filter(student => {
      if (this.filterType === 'all') return true;
      if (this.filterType === 'Male') return student.gender === 'Male';
      if (this.filterType === 'Female') return student.gender === 'Female';
      if (this.filterType === 'graded_today') return !!student.is_graded_today;
      if (this.filterType === 'not_graded') return !!student.has_ungraded_homework;
      if (this.filterType === 'no_homework') return !student.has_ungraded_homework && !student.is_graded_today;
      return true;
    });
  }

  setFilter(type: any) {
    this.filterType = type;
  }

  async openStudentHomeworkModal(student: Student) {
    const modal = await this.modalCtrl.create({
      component: StudentHomeworkComponent,
      componentProps: {
        student,
        circleId: this.circleId
      }
    });

    await modal.present();

    await modal.onWillDismiss();
    // Refresh student data when modal closes as grading statuses might have changed
    await this.fetchStudents();
  }
}
