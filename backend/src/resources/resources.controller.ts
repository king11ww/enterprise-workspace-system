import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ResourcesService } from './resources.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { QueryResourceDto } from './dto/query-resource.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Resources')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tài nguyên kèm phân trang, tìm kiếm và lọc',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tài nguyên và thông tin phân trang' })
  async findAll(@Query() query: QueryResourceDto) {
    return this.resourcesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một tài nguyên theo ID' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết tài nguyên kèm lịch đặt sắp tới' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài nguyên' })
  async findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Tạo mới một tài nguyên (Chỉ ADMIN hoặc MANAGER)' })
  @ApiResponse({ status: 201, description: 'Tài nguyên được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập (Yêu cầu ADMIN hoặc MANAGER)' })
  @ApiResponse({ status: 409, description: 'Tên tài nguyên đã tồn tại' })
  async create(
    @Body() dto: CreateResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resourcesService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Cập nhật tài nguyên theo ID (Chỉ ADMIN hoặc MANAGER)' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  @ApiResponse({ status: 200, description: 'Tài nguyên được cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài nguyên' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resourcesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa tài nguyên theo ID (Chỉ duy nhất ADMIN)' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  @ApiResponse({ status: 200, description: 'Tài nguyên đã bị xóa' })
  @ApiResponse({ status: 400, description: 'Không thể xóa vì đang có lịch đặt sắp tới' })
  @ApiResponse({ status: 403, description: 'Yêu cầu quyền ADMIN' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài nguyên' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resourcesService.remove(id, user.id);
  }
}
