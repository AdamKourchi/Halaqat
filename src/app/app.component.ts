import { Component, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IonApp, IonRouterOutlet, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { DatabaseService } from './core/database/database.service';
import { UserRepository } from './core/repositories/user.repository';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet, IonContent, IonSpinner],
})
export class AppComponent {
  isReady = false;

  private platform = inject(Platform);
  private dbService = inject(DatabaseService);
  private userRepo = inject(UserRepository);
  private router = inject(Router);

  constructor() {
    this.initializeApp();
  }

  async initializeApp(): Promise<void> {
    await this.platform.ready();

    try {
      await this.dbService.initialize();
      const userCount = await this.userRepo.count();

      // Avoid flashing the home screen by routing straight away
      if (userCount === 0) {
        await this.router.navigate(['/register'], { replaceUrl: true });
      }

      console.log('[App] Database ready ✔');
    } catch (err) {
      console.error('[App] Fatal – could not initialize database', err);
    } finally {
      // Add a tiny delay so the transition looks smooth
      setTimeout(() => {
        this.isReady = true;
      }, 500);
    }
  }
}
