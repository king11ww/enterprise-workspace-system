import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: 'ID của tài nguyên cần đặt', example: '3f6c2a9e-0000-0000-0000-000000000000' })
  @IsUUID('all', { message: 'resourceId phải là UUID hợp lệ' })
  @IsNotEmpty()
  resourceId: string;

  @ApiProperty({ description: 'Thời điểm bắt đầu (ISO 8601)', example: '2026-10-26T07:00:00.000Z' })
  @IsDateString({}, { message: 'startTime phải là chuỗi thời gian ISO 8601' })
  startTime: string;

  @ApiProperty({ description: 'Thời điểm kết thúc (ISO 8601)', example: '2026-10-26T09:00:00.000Z' })
  @IsDateString({}, { message: 'endTime phải là chuỗi thời gian ISO 8601' })
  endTime: string;

  @ApiPropertyOptional({ example: 'Sprint Planning', description: 'Tiêu đề cuộc họp / mục đích sử dụng' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Cần chuẩn bị máy chiếu', description: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
