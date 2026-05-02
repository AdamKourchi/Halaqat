import { Component, inject, OnInit, Output, EventEmitter } from '@angular/core';
import {
  IonIcon,
  IonCard,
  IonCardContent,
  IonButton,
  ModalController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  trash,
  shareSocial,
  documentText,
  close,
  pencil,
  people,
  albumsOutline,
  chevronBack,
  checkmarkCircle,
  book,
} from 'ionicons/icons';
import {
  CircleRepository,
  StudentRepository,
  TeacherRepository,
  HomeworkRepository,
  ExcelService,
  JsonService,
} from '@core';
import { Circle, Teacher } from '@core';
import { CreateCircleComponent } from './components/create-circle/create-circle.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-my-circles',
  templateUrl: './my-circles.component.html',
  styleUrls: ['./my-circles.component.scss'],
  standalone: true,
  imports: [IonButton, IonCardContent, IonCard, IonIcon],
})
export class MyCirclesComponent implements OnInit {
  private circleRepo = inject(CircleRepository);
  private modalCtrl = inject(ModalController);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private excelService = inject(ExcelService);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private jsonService = inject(JsonService);
  private teacherRepo = inject(TeacherRepository);

  circles: Circle[] = [];
  owner: Teacher | null = null;
  studentCountMap: Record<string, number> = {};

  selectionMode = false;
  selectedCircles: Set<string> = new Set();
  private pressTimer: any;
  private longPressActive = false;

  private stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  getAvatarColor(name: string): string {
    const hash = this.stringToHash(name);
    // Base hue (0-360)
    const h1 = Math.abs(hash) % 360; 

    // We use HSL to ensure the colors are bright and vibrant
    return `hsl(${h1}, 75%, 55%)`;
  }


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

  async fetchCircles() {
    try {
      this.circles = await this.circleRepo.findOwnerCircles();
      // Fetch student counts in parallel
      const counts = await Promise.all(
        this.circles.map((c) =>
          c.id
            ? this.studentRepo
                .findByCircleId(c.id)
                .then((s) => ({ id: c.id!, count: s.length }))
            : Promise.resolve({ id: '', count: 0 })
        )
      );
      this.studentCountMap = counts.reduce((acc, r) => {
        acc[r.id] = r.count;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      console.log(error);
    }
  }

  async fetchOwnerData() {
    try {
      const owner = await this.teacherRepo.findOwner();
      this.owner = owner;
    } catch (error) {
      console.log(error);
    }
  }

  async openCreateCircleModal() {
    const modal = await this.modalCtrl.create({
      component: CreateCircleComponent,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      try {
        if (this.owner && this.owner.id !== undefined) {
          await this.circleRepo.create(this.owner.id, data.name, data.type);
        }
      } catch (error) {
        console.log(error);
      } finally {
        this.fetchCircles();
      }
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
              await this.fetchCircles();
              this.cancelSelection();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async editSelected() {
    if (this.selectedCircles.size !== 1) return;

    const circleId = Array.from(this.selectedCircles)[0];
    const circle = this.circles.find((c) => c.id === circleId);

    if (!circle) return;

    const modal = await this.modalCtrl.create({
      component: CreateCircleComponent,
      componentProps: {
        isEdit: true,
        circleName: circle.name,
        circleType: circle.type,
      },
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      try {
        await this.circleRepo.update(circleId, {
          name: data.name,
          type: data.type,
        });
      } catch (error) {
        console.log(error);
      } finally {
        this.fetchCircles();
        this.cancelSelection();
      }
    }
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
          text: 'تصدير بصيغة الآيات',
          handler: async (data) => this.generateExcelReport(data, 'ayah'),
        },
        {
          text: 'تصدير بصيغة الأثمان',
          handler: async (data) => this.generateExcelReport(data, 'hizb'),
        },
      ],
    });
    await alert.present();
  }

  private async generateExcelReport(data: any, displayMode: 'ayah' | 'hizb') {
    if (data.startDate && data.endDate) {
      const allStudents: any[] = [];
      const allHomeworks: any[] = [];

      for (const circleId of this.selectedCircles) {
        const students = await this.studentRepo.findByCircleId(circleId);
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
          displayMode
        );
      } else {
        await this.excelService.generateMultipleCirclesExcel(
          allStudents,
          filteredHomeworks,
          displayMode
        );
      }
    }
  }

  ngOnInit() {
    this.fetchOwnerData();
    this.fetchCircles();
    addIcons({
      add,
      trash,
      shareSocial,
      documentText,
      close,
      pencil,
      people,
      'albums-outline': albumsOutline,
      'chevron-back': chevronBack,
      'checkmark-circle': checkmarkCircle,
      book,
    });
  }
}
