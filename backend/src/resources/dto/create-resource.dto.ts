import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType, ResourceStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResourceDto {
  @ApiProperty({ example: 'Phòng họp C (Meeting Room C)', description: 'Tên tài nguyên' })
  @IsString()
  @IsNotEmpty({ message: 'Tên tài nguyên không được để trống' })
  name: string;

  @ApiProperty({
    enum: ResourceType,
    example: ResourceType.MEETING_ROOM,
    description: 'Phân loại tài nguyên (MEETING_ROOM, DESK, DEVICE)',
  })
  @IsEnum(ResourceType, { message: 'Type phải là MEETING_ROOM, DESK, hoặc DEVICE' })
  type: ResourceType;

  @ApiPropertyOptional({ example: 10, default: 1, description: 'Sức chứa tối đa (người hoặc thiết bị)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Sức chứa tối thiểu phải là 1' })
  capacity?: number;

  @ApiPropertyOptional({
    enum: ResourceStatus,
    example: ResourceStatus.AVAILABLE,
    default: ResourceStatus.AVAILABLE,
    description: 'Trạng thái tài nguyên (AVAILABLE, MAINTENANCE, UNAVAILABLE)',
  })
  @IsOptional()
  @IsEnum(ResourceStatus, { message: 'Status phải là AVAILABLE, MAINTENANCE, hoặc UNAVAILABLE' })
  status?: ResourceStatus;

  @ApiPropertyOptional({ example: 'Tầng 4 - Cánh Tây', description: 'Vị trí thực tế' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Trang bị 1 màn hình 4K và micro đa hướng', description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;
}
