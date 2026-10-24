import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingDto } from './dto/query-booking.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt tài nguyên (có Redis distributed lock chống double-booking)' })
  @ApiResponse({ status: 201, description: 'Đặt chỗ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu thời gian không hợp lệ hoặc tài nguyên không khả dụng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài nguyên' })
  @ApiResponse({ status: 409, description: 'Trùng lịch hoặc tài nguyên đang bị khóa bởi giao dịch khác' })
  async create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách lịch đặt (EMPLOYEE chỉ thấy lịch của mình)' })
  async findAll(@Query() query: QueryBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một lịch đặt' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findOne(id, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy lịch đặt (chủ sở hữu, MANAGER hoặc ADMIN)' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lịch đặt' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.cancel(id, user);
  }
}
