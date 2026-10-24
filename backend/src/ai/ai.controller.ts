import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { ParseIntentDto } from './dto/parse-intent.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('AI Natural Language Booking')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('parse-intent')
  @ApiOperation({
    summary: 'Trích xuất ý định đặt chỗ từ ngôn ngữ tự nhiên (Gemini AI Structured Output)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trích xuất thành công: trả về resourceId, thời gian và booking payload để auto-fill form',
  })
  @ApiResponse({ status: 400, description: 'Prompt rỗng hoặc không hợp lệ' })
  async parseIntent(
    @Body() dto: ParseIntentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiService.parseIntent(dto, user);
  }
}
