import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { UserRepository } from '../../core/repositories/user.repository';
import { MyCirclesComponent } from '../my-circles/my-circles.component';
import { SharedCirclesComponent } from '../shared-circles/shared-circles.component';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    MyCirclesComponent,
    SharedCirclesComponent,
  ],
})
export class HomePage implements OnInit {
  segmentValue: 'mine' | 'shared' = 'mine';
  userCount = 0;

  private userRepo = inject(UserRepository);
  private cdr = inject(ChangeDetectorRef);

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
  }

  async ngOnInit() {
    this.userCount = await this.userRepo.count();
    this.cdr.detectChanges();
  }
}
