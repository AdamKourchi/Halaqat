import { Component, OnInit, inject } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  AlertController,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trash,
  shareSocial,
  documentText,
  close,
  person,
  cloudUpload,
  checkmarkCircle,
  chevronBack,
  cloudDownloadOutline,
} from 'ionicons/icons';
import {
  CircleRepository,
  StudentRepository,
  HomeworkRepository,
  ExcelService,
  TeacherRepository,
  Teacher,
  Circle,
  JsonService,
} from '@core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-shared-circles',
  templateUrl: './shared-circles.component.html',
  styleUrls: ['./shared-circles.component.scss'],
  standalone: true,
  imports: [IonIcon, IonButton, IonCard, IonCardContent],
})
export class SharedCirclesComponent implements OnInit {
  constructor() {}
  private circleRepo = inject(CircleRepository);
  private teacherRepo = inject(TeacherRepository);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private jsonService = inject(JsonService);

  circles: Circle[] = [];
  teacher: Teacher | null = null;
  teachers: Teacher[] = [];

  selectionMode = false;
  selectedCircles: Set<string> = new Set();
  private pressTimer: any;
  private longPressActive = false;

  // 1. ADD THIS OUTPUT
  @Output() selectionState = new EventEmitter<{
    isActive: boolean;
    count: number;
  }>();

  // 2. ADD THIS HELPER METHOD
  private emitSelectionState() {
    this.selectionState.emit({
      isActive: this.selectionMode,
      count: this.selectedCircles.size,
    });
  }

  // 3. UPDATE THESE THREE METHODS to call the helper
  enableSelectionMode(circle: Circle) {
    if (!circle.id) return;
    this.selectionMode = true;
    if (!this.selectedCircles.has(circle.id)) {
      this.selectedCircles.add(circle.id);
    }
    this.emitSelectionState(); // <-- Added
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
    this.emitSelectionState(); // <-- Added
  }

  cancelSelection() {
    this.selectionMode = false;
    this.selectedCircles.clear();
    this.emitSelectionState(); // <-- Added
  }

  async fetchSharedCircles() {
    try {
      this.circles = await this.circleRepo.findAllSharedCircles();
      console.log(this.circles);
    } catch (error) {
      console.error(error);
    }
  }

  async fetchTeacherData() {
    try {
      const teacher = await this.teacherRepo.findOwner();
      this.teacher = teacher;
    } catch (error) {
      console.log(error);
    }
  }

  async fetchTeachersData() {
    try {
      this.teachers = await this.teacherRepo.findAll();
    } catch (error) {
      console.log(error);
    }
  }

  findTeacherName(id: string) {
    return this.teachers.find((t) => t.id === id)?.name || 'لا يوجد معلم';
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

  async deleteSelected() {
    const count = this.selectedCircles.size;
    const label = count === 1 ? 'هذه الحلقة' : `${count} حلقات`;

    const alert = await this.alertCtrl.create({
      header: 'تأكيد الحذف',
      message: `هل أنت متأكد أنك تريد حذف ${label}؟ لا يمكن التراجع عن هذا الإجراء.`,
      buttons: [
        { text: 'إلغاء', role: 'cancel' },
        {
          text: 'حذف',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: async () => {
            try {
              for (const circleId of this.selectedCircles) {
                await this.circleRepo.delete(circleId);
              }
            } catch (error) {
              console.log(error);
            } finally {
              await this.fetchSharedCircles();
              this.cancelSelection();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async shareSelected() {
    if (this.selectedCircles.size === 0) return;
    if (this.selectedCircles.size === 1) {
      await this.jsonService.generateJson(
        this.selectedCircles.values().next().value!
      );
    } else {
      await this.jsonService.generateMultipleCirclesJson(
        Array.from(this.selectedCircles)
      );
    }
  }

  async importCircle() {
    const input = document.getElementById('fileImport') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const content = e.target.result;
        const data = JSON.parse(content);
        let circlesData = [];
        if (Array.isArray(data)) {
          circlesData = data;
        } else {
          circlesData = [data];
        }

        for (const circleData of circlesData) {
          await this.jsonService.importCircleData(circleData);
        }
        await this.fetchSharedCircles();
        await this.fetchTeachersData();
        this.alertCtrl
          .create({
            header: 'نجاح',
            message: 'تم استيراد البيانات بنجاح',
            buttons: ['حسنا'],
          })
          .then((a) => a.present());
      } catch (err) {
        console.error(err);
        this.alertCtrl
          .create({
            header: 'خطأ',
            message: 'فشل استيراد الملف. تأكد من صحة الملف.',
            buttons: ['حسنا'],
          })
          .then((a) => a.present());
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
                const students = await this.studentRepo.findByCircleId(
                  circleId
                );
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
                  filteredHomeworks
                );
              } else {
                await this.excelService.generateMultipleCirclesExcel(
                  allStudents,
                  filteredHomeworks
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
    this.fetchTeacherData();
    this.fetchTeachersData();
    addIcons({
      trash,
      shareSocial,
      documentText,
      close,
      person,
      'cloud-upload': cloudUpload,
      'checkmark-circle': checkmarkCircle,
      'chevron-back': chevronBack,
      'cloud-download-outline': cloudDownloadOutline,
    });
  }
}
