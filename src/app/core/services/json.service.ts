import { inject, Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Platform } from '@ionic/angular';
import {
  CircleRepository,
  StudentRepository,
  HomeworkRepository,
  Circle,
  TeacherRepository,
} from '@core';
@Injectable({
  providedIn: 'root',
})
export class JsonService {
  constructor(private platform: Platform) {}
  private circleRepo = inject(CircleRepository);
  private studentRepo = inject(StudentRepository);
  private homeworkRepo = inject(HomeworkRepository);
  private teacherRepo = inject(TeacherRepository);

  async generateJson(circleId: string) {
    const data = await this.circleRepo.extractToJSON(circleId);
    const circle: Circle | null = await this.circleRepo.findById(circleId);

    if (!circle) {
      return;
    } else {
      const fileName = `حلقة_${circle?.name}.json`;

      // 1. Ensure the data is a string format. If it's an object, stringify it.
      const stringifiedData =
        typeof data === 'string' ? data : JSON.stringify(data, null, 2);

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: stringifiedData,
        directory: Directory.Cache,
        encoding: Encoding.UTF8, // 2. CRITICAL: Tell Capacitor this is raw UTF-8 text, not Base64
      });

      await Share.share({
        title: 'Share JSON',
        text: 'Here is the JSON data:',
        url: savedFile.uri,
      });
    }
  }

  async generateMultipleCirclesJson(selectedCircles: string[]) {
    let dataArray = [];
    for (const circleId of selectedCircles) {
      const jsonStr = await this.circleRepo.extractToJSON(circleId);
      dataArray.push(JSON.parse(jsonStr));
    }
    const fileName = `حلقات.json`;

    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: JSON.stringify(dataArray, null, 2),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Share JSON',
      text: 'Here is the JSON data:',
      url: savedFile.uri,
    });
  }

  async importCircleData(data: any) {
    console.log("data ",data);
    
    if (data.teacher) {      
      await this.teacherRepo.upsert(data.teacher);
    }
    if (data.circle) {
      await this.circleRepo.upsert(data.circle);
    }

    if (data.students && Array.isArray(data.students)) {
      for (const student of data.students) {
        await this.studentRepo.upsert(student);
      }
    }
    if (data.homeworks && Array.isArray(data.homeworks)) {
      for (const hw of data.homeworks) {
        await this.homeworkRepo.upsert(hw);
      }
    }
  }
}
