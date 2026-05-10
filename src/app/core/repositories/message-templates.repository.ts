import { Injectable } from '@angular/core';
import { BaseRepository } from './base.repository';

/**
 * MessageTemplatesRepository
 *
 * All SQL that touches the `message_templates` table lives here.
 */
@Injectable({ providedIn: 'root' })
export class MessageTemplatesRepository extends BaseRepository {
  async getMessageTemplate(type: string): Promise<{ content: string } | null> {
    if (type == 'assignment') {
      const result = await this.query(
        'SELECT content FROM message_templates WHERE type = ?',
        ['assignment']
      );
      return (result[0] as { content: string }) ?? null;
    } else if (type == 'grading') {
      const result = await this.query(
        'SELECT content FROM message_templates WHERE type = ?',
        ['grading']
      );
      return (result[0] as { content: string }) ?? null;
    }
    return null;
  }

  async saveMessageTemplate(template: string, type: string) {
    const result = await this.query(
      'UPDATE message_templates SET content = ? WHERE type = ?',
      [template, type]
    );
    return result;
  }

  async generateWhatsAppMessage(
    type: 'grading' | 'assignment',
    data: Record<string, string>
  ): Promise<string> {
    const templateRow = await this.getMessageTemplate(type);
    let text = templateRow ? templateRow.content : '';

    if (!text) {
      if (type === 'grading') {
        text = `السلام عليكم،
تم تقييم تسميع الطالب {{اسم_الطالب}}:
التقييم: {{التقييم}}
عدد الأخطاء: {{عدد_الأخطاء}}
ملاحظات: {{ملاحظات}}

بالتوفيق!`;
      } else {
        text = `السلام عليكم،
تم تعيين واجب جديد للطالب {{اسم_الطالب}}:
{{الواجب}}

بالتوفيق!`;
      }
    }

    for (const key in data) {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
    }

    // Clean up empty lines if remark was empty but template has `ملاحظات: `
    if (type === 'grading' && !data['ملاحظات']) {
      text = text.replace(/ملاحظات:\s*\n?/g, '');
    }

    return text.trim();
  }
}
