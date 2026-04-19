import { Component, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IonApp, IonRouterOutlet, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { DatabaseService } from './core/database/database.service';
import { Router } from '@angular/router';
import { TeacherRepository, JsonService, ThemeService } from '@core';
import { SendIntent } from '@mindlib-capacitor/send-intent';
import { AlertController } from '@ionic/angular/standalone';
import { Filesystem, Encoding } from '@capacitor/filesystem';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet, IonContent, IonSpinner],
})
export class AppComponent {
  isReady = false;

  // 👉 1. ADD THIS: A promise to block execution until the DB is ready
  private appInitializedPromise: Promise<void>;
  private resolveAppInitialized!: () => void;

  private platform = inject(Platform);
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private teacherRepo = inject(TeacherRepository);
  private jsonService = inject(JsonService);
  private alertCtrl = inject(AlertController);
  // Eagerly inject so the constructor runs and applies the stored theme on boot
  private themeService = inject(ThemeService);

  constructor() {
    // 👉 2. INITIALIZE THE PROMISE
    this.appInitializedPromise = new Promise((resolve) => {
      this.resolveAppInitialized = resolve;
    });

    this.initializeApp();
    
    window.addEventListener("sendIntentReceived", () => {
      this.checkIncomingIntents();
    });

    App.addListener('appUrlOpen', (data: any) => {
      if (data.url) {
        this.processImportedFile(data.url);
      }
    });
  }

  async initializeApp(): Promise<void> {
    await this.platform.ready();

    try {
      await this.dbService.initialize();
      const teacherCount = await this.teacherRepo.count();

      if (teacherCount === 0) {
        await this.router.navigate(['/register'], { replaceUrl: true });
      }

      // 👉 3. RESOLVE THE PROMISE HERE: The DB is now officially open!
      this.resolveAppInitialized();

      // Now check for Share intents
      await this.checkIncomingIntents();

    } catch (err) {
      console.error('[App] Fatal – could not initialize database', err);
      // Resolve anyway so the app doesn't hang infinitely if DB fails, 
      // though you'll get errors down the line.
      this.resolveAppInitialized(); 
    } finally {
      setTimeout(() => {
        this.isReady = true;
      }, 500);
    }
  }

  async processImportedFile(rawUrl: string) {
    // 👉 4. ADD THIS: Wait here until resolveAppInitialized() is called!
    await this.appInitializedPromise;

    try {
      const resultUrl = decodeURIComponent(rawUrl);
      
      const content = await Filesystem.readFile({ 
        path: resultUrl,
        encoding: Encoding.UTF8 
      });

      if (content && content.data) {
        const textData = content.data as string;
        const dataObj = JSON.parse(textData);
        const circlesData = Array.isArray(dataObj) ? dataObj : [dataObj];
        
        for (const cd of circlesData) {
          await this.jsonService.importCircleData(cd);
        }
        
        const successAlert = await this.alertCtrl.create({
          header: 'نجاح',
          message: 'تم استيراد حلقة بنجاح من الملف الخارجي.',
          buttons: ['حسنا']
        });
        await successAlert.present();

        // Refresh UI
        const currentUrl = this.router.url;
        this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
          this.router.navigate([currentUrl]);
        });
      }
    } catch (err: any) {
      console.error('File import failed', err);
      const errorAlert = await this.alertCtrl.create({
        header: 'خطأ في قراءة الملف',
        message: `فشل استيراد الملف. السبب: ${err.message || JSON.stringify(err)}`,
        buttons: ['حسنا']
      });
      await errorAlert.present();
    }
  }

  async checkIncomingIntents() {
    try {
      const result: any = await SendIntent.checkSendIntentReceived();
      if (result && result.url) {
        await this.processImportedFile(result.url);
        SendIntent.finish();
      } else {
        SendIntent.finish();
      }
    } catch (error) {
      console.log('No share intent received or error occurred:', error);
    }
  }
}