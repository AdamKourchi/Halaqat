// import { Component, inject } from '@angular/core';
// import { Platform } from '@ionic/angular';
// import { IonApp, IonRouterOutlet, IonContent, IonSpinner } from '@ionic/angular/standalone';
// import { DatabaseService } from './core/database/database.service';
// import { Router } from '@angular/router';
// import { TeacherRepository, JsonService } from '@core';
// import { SendIntent } from '@mindlib-capacitor/send-intent';
// import { AlertController } from '@ionic/angular/standalone';
// import { Filesystem, Encoding } from '@capacitor/filesystem';

// @Component({
//   selector: 'app-root',
//   templateUrl: 'app.component.html',
//   styleUrls: ['app.component.scss'],
//   imports: [IonApp, IonRouterOutlet, IonContent, IonSpinner],
// })
// export class AppComponent {
//   isReady = false;

//   private platform = inject(Platform);
//   private dbService = inject(DatabaseService);
//   private router = inject(Router);
//   private teacherRepo = inject(TeacherRepository);
//   private jsonService = inject(JsonService);
//   private alertCtrl = inject(AlertController);

//   constructor() {
//     this.initializeApp();
    
//     // 1. ADD THIS: Listen for intents when the app is already open in the background
//     window.addEventListener("sendIntentReceived", () => {
//       this.checkIncomingIntents();
//     });
//   }

//   async initializeApp(): Promise<void> {
//     await this.platform.ready();

//     try {
//       await this.dbService.initialize();
//       const teacherCount = await this.teacherRepo.count();

//       if (teacherCount === 0) {
//         await this.router.navigate(['/register'], { replaceUrl: true });
//       }

//       // Check intents for Cold Starts
//       await this.checkIncomingIntents();

//     } catch (err) {
//       console.error('[App] Fatal – could not initialize database', err);
//     } finally {
//       setTimeout(() => {
//         this.isReady = true;
//       }, 500);
//     }
//   }

//   async checkIncomingIntents() {
//     try {
//       const result: any = await SendIntent.checkSendIntentReceived();
      
//       if (result && result.url) {
//         const resultUrl = decodeURIComponent(result.url);
        
//         try {
//           const content = await Filesystem.readFile({ 
//             path: resultUrl,
//             encoding: Encoding.UTF8 
//           });

//           if (content && content.data) {
//             const textData = content.data as string;
//             const dataObj = JSON.parse(textData);
//             const circlesData = Array.isArray(dataObj) ? dataObj : [dataObj];
            
//             for (const cd of circlesData) {
//               await this.jsonService.importCircleData(cd);
//             }
            
//             const alert = await this.alertCtrl.create({
//               header: 'نجاح',
//               message: 'تم استيراد حلقة بنجاح من الملف الخارجي.',
//               buttons: ['حسنا']
//             });
//             await alert.present();

//             // 2. ADD THIS: Force the UI to refresh so the new circle appears immediately
//             // (Change '/home' or '/' to whatever your main circles page route is)
//             const currentUrl = this.router.url;
//             this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
//               this.router.navigate([currentUrl]);
//             });
//           }
//         } catch (err: any) {
//           console.error('Failed to read or parse the JSON file from Intent', err);
          
//           // 3. ADD THIS: Show an error alert so you aren't flying blind!
//           const errorAlert = await this.alertCtrl.create({
//             header: 'خطأ في قراءة الملف',
//             message: `فشل استيراد الملف. السبب: ${err.message || JSON.stringify(err)}`,
//             buttons: ['حسنا']
//           });
//           await errorAlert.present();
          
//         } finally {
//           SendIntent.finish();
//         }
//       }
//     } catch (error) {
//       console.log('No intent received or error occurred:', error);
//     }
//   }
// }
import { Component, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IonApp, IonRouterOutlet, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { DatabaseService } from './core/database/database.service';
import { Router } from '@angular/router';
import { TeacherRepository, JsonService } from '@core';
import { SendIntent } from '@mindlib-capacitor/send-intent';
import { AlertController } from '@ionic/angular/standalone';
import { Filesystem, Encoding } from '@capacitor/filesystem';
import { App } from '@capacitor/app'; // 👉 IMPORT THIS

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
  private router = inject(Router);
  private teacherRepo = inject(TeacherRepository);
  private jsonService = inject(JsonService);
  private alertCtrl = inject(AlertController);

  constructor() {
    this.initializeApp();
    
    // 1. Listen for "Share" actions when app is in background
    window.addEventListener("sendIntentReceived", () => {
      this.checkIncomingIntents();
    });

    // 2. 👉 Listen for "Tap/View" actions (From MainActivity)
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

      // Check for "Share" actions on Cold Start
      await this.checkIncomingIntents();
      // (Note: We don't need a cold start check for Taps, Capacitor handles it automatically!)

    } catch (err) {
      console.error('[App] Fatal – could not initialize database', err);
    } finally {
      setTimeout(() => {
        this.isReady = true;
      }, 500);
    }
  }

  // --- THE NEW UNIFIED FILE PROCESSOR ---
  async processImportedFile(rawUrl: string) {
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

  // --- SHARE INTENT CHECKER ---
  async checkIncomingIntents() {
    try {
      const result: any = await SendIntent.checkSendIntentReceived();
      if (result && result.url) {
        // Pass the URL to our unified processor
        await this.processImportedFile(result.url);
        // CRITICAL: Close the intent
        SendIntent.finish();
      } else {
        SendIntent.finish();
      }
    } catch (error) {
      console.log('No share intent received or error occurred:', error);
    }
  }
}