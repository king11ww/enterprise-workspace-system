import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType, ResourceStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryResourceDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm tương đối theo tên hoặc vị trí' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ResourceType,
    description: 'Lọc theo phân loại tài nguyên (MEETING_ROOM, DESK, DEVICE)',
  })
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @ApiPropertyOptional({
    enum: ResourceStatus,
    description: 'Lọc theo trạng thái hoạt động (AVAILABLE, MAINTENANCE, UNAVAILABLE)',
  })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @ApiPropertyOptional({ example: 4, description: 'Sức chứa tối thiểu yêu cầu' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional({ default: 1, example: 1, description: 'Trang hiện tại (phân trang)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, example: 10, description: 'Số lượng bản ghi mỗi trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
