import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParseIntentDto } from './dto/parse-intent.dto.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

export interface ExtractedIntent {
  resourceName: string;
  startTime: string; // ISO 8601
  durationMinutes: number;
  title?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('your_gemini_api_key')) {
      this.genAI = new GoogleGenAI({ apiKey: apiKey.trim() });
      this.logger.log('Google Gemini AI initialized successfully');
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured or placeholder detected. Falling back to rule-based smart parser.',
      );
    }
  }

  async parseIntent(dto: ParseIntentDto, user: AuthenticatedUser) {
    const now = new Date();
    const prompt = dto.prompt.trim();

    let extracted: ExtractedIntent;

    if (this.genAI) {
      extracted = await this.extractWithGemini(prompt, now);
    } else {
      extracted = this.extractWithRuleFallback(prompt, now);
    }

    // Match extracted resource name with actual resources in database
    const allResources = await this.prisma.resource.findMany({
      where: { status: 'AVAILABLE' },
      select: {
        id: true,
        name: true,
        type: true,
        capacity: true,
        location: true,
      },
    });

    const matchedResource = this.findBestMatchResource(extracted.resourceName, allResources);

    const startDate = new Date(extracted.startTime);
    const endDate = new Date(startDate.getTime() + extracted.durationMinutes * 60 * 1000);

    const bookingPayload = matchedResource
      ? {
          resourceId: matchedResource.id,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          title: extracted.title || `Lịch đặt qua AI: ${matchedResource.name}`,
        }
      : null;

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AI_INTENT_PARSED',
        entityType: 'AiIntent',
        entityId: matchedResource?.id || '00000000-0000-0000-0000-000000000000',
        payload: {
          prompt,
          extracted: extracted as any,
          matchedResourceId: matchedResource?.id || null,
          matchedResourceName: matchedResource?.name || null,
          usedGemini: Boolean(this.genAI),
        },
      },
    });

    return {
      success: true,
      prompt,
      engine: this.genAI ? 'Gemini 2.5 Flash' : 'Smart Rule Parser (Fallback)',
      extracted: {
        ...extracted,
        endTime: endDate.toISOString(),
      },
      matchedResource,
      bookingPayload,
      message: matchedResource
        ? `Đã nhận diện thành công: ${matchedResource.name} (${extracted.durationMinutes} phút từ ${startDate.toLocaleString('vi-VN')})`
        : `Đã phân tích thời gian nhưng chưa tìm thấy tài nguyên trùng khớp với tên "${extracted.resourceName}"`,
    };
  }

  private async extractWithGemini(prompt: string, now: Date): Promise<ExtractedIntent> {
    try {
      const nowIso = now.toISOString();
      const systemInstruction = `
Bạn là trợ lý AI thông minh chuyên phân tích câu lệnh đặt phòng họp và thiết bị doanh nghiệp.
Thời điểm hiện tại của hệ thống: ${nowIso} (Múi giờ Asia/Ho_Chi_Minh GMT+7).
Nhiệm vụ: Trích xuất thông tin đặt chỗ từ câu nói tự nhiên của người dùng sang định dạng JSON có cấu trúc.

Quy tắc thời gian:
- "chiều mai lúc 14:00" -> tính ngày mai vào lúc 14:00:00.000 theo GMT+7 quy ra ISO 8601.
- "2 tiếng" hoặc "trong 2 giờ" -> durationMinutes = 120.
- "30 phút" -> durationMinutes = 30. Mặc định là 60 phút nếu người dùng không nói thời lượng.
- resourceName: tên phòng họp, bàn làm việc hoặc thiết bị được nhắc tới (ví dụ: "Phòng họp A", "Hot Desk 101", "Máy chiếu").
- title: mục đích hoặc tiêu đề cuộc họp ngắn gọn.
`;

      const response = await this.genAI!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resourceName: {
                type: Type.STRING,
                description: 'Tên phòng họp, bàn làm việc hoặc thiết bị được yêu cầu',
              },
              startTime: {
                type: Type.STRING,
                description: 'Thời điểm bắt đầu theo chuẩn ISO 8601',
              },
              durationMinutes: {
                type: Type.INTEGER,
                description: 'Thời lượng đặt tính bằng phút',
              },
              title: {
                type: Type.STRING,
                description: 'Tiêu đề ngắn gọn của cuộc họp hoặc mục đích sử dụng',
              },
            },
            required: ['resourceName', 'startTime', 'durationMinutes'],
          },
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      return {
        resourceName: parsed.resourceName || 'Phòng họp',
        startTime: parsed.startTime || new Date(now.getTime() + 3600000).toISOString(),
        durationMinutes: Number(parsed.durationMinutes) || 60,
        title: parsed.title || 'Đặt phòng họp qua AI',
      };
    } catch (err) {
      this.logger.error(`Gemini API parse failed: ${err instanceof Error ? err.message : String(err)}`);
      return this.extractWithRuleFallback(prompt, now);
    }
  }

  private extractWithRuleFallback(prompt: string, now: Date): ExtractedIntent {
    const lower = prompt.toLowerCase();

    // 1. Detect Resource Name
    let resourceName = 'Phòng họp';
    if (lower.includes('phòng họp a') || lower.includes('meeting room a')) {
      resourceName = 'Phòng họp A';
    } else if (lower.includes('phòng họp b') || lower.includes('meeting room b')) {
      resourceName = 'Phòng họp B';
    } else if (lower.includes('hội đồng') || lower.includes('boardroom') || lower.includes('vip')) {
      resourceName = 'Phòng hội đồng';
    } else if (lower.includes('hot desk 101') || lower.includes('desk 101')) {
      resourceName = 'Hot Desk 101';
    } else if (lower.includes('hot desk 102') || lower.includes('desk 102')) {
      resourceName = 'Hot Desk 102';
    } else if (lower.includes('máy chiếu') || lower.includes('projector')) {
      resourceName = 'Máy chiếu di động 4K';
    }

    // 2. Detect Duration
    let durationMinutes = 60;
    const hourMatch = lower.match(/(\d+)\s*(tiếng|giờ|hours?|h\b)/);
    const minuteMatch = lower.match(/(\d+)\s*(phút|mins?|m\b)/);

    if (hourMatch) {
      durationMinutes = parseInt(hourMatch[1], 10) * 60;
    } else if (minuteMatch) {
      durationMinutes = parseInt(minuteMatch[1], 10);
    }

    // 3. Detect Time
    const targetDate = new Date(now);
    if (lower.includes('ngày mai') || lower.includes('chiều mai') || lower.includes('sáng mai') || lower.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const timeMatch = lower.match(/(\d{1,2})(:|\s*giờ\s*|\s*h\s*)(\d{2})?/);
    let hour = 14;
    let minute = 0;

    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      if (timeMatch[3]) {
        minute = parseInt(timeMatch[3], 10);
      }
      if (lower.includes('chiều') && hour < 12) {
        hour += 12;
      }
    }

    targetDate.setHours(hour, minute, 0, 0);
    if (targetDate.getTime() < now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    return {
      resourceName,
      startTime: targetDate.toISOString(),
      durationMinutes,
      title: `Đặt chỗ: ${resourceName}`,
    };
  }

  private findBestMatchResource(
    resourceName: string,
    resources: Array<{ id: string; name: string; type: any; capacity: number; location: string | null }>,
  ) {
    if (!resourceName || resources.length === 0) return null;

    const normTarget = resourceName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exact or inclusion match
    for (const r of resources) {
      const normName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normName.includes(normTarget) || normTarget.includes(normName)) {
        return r;
      }
    }

    // Partial word match
    const words = resourceName.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    for (const r of resources) {
      const lower = r.name.toLowerCase();
      if (words.some((w) => lower.includes(w))) {
        return r;
      }
    }

    return resources[0] || null;
  }
}
