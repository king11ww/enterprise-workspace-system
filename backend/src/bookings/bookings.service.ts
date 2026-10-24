import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { QueryBookingDto } from './dto/query-booking.dto.js';
import { NotificationsProducerService } from '../notifications/notifications-producer.service.js';

/** Postgres exclusion constraint created in migration `booking_no_overlap`. */
const OVERLAP_CONSTRAINT = 'bookings_no_overlap';

const LOCK_TTL_MS = 5000;
const LOCK_RETRY_COUNT = 10;
const LOCK_RETRY_DELAY_MS = 50;

const bookingInclude = {
  resource: { select: { id: true, name: true, type: true, location: true } },
  user: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsProducer: NotificationsProducerService,
  ) {}

  /**
   * Booking flow (see project plan, Phase 2.3):
   * 1. Validate input & resource.
   * 2. Acquire Redis mutex `lock:resource:{resourceId}`.
   * 3. Inside the lock: check overlap in Postgres -> insert booking + audit log.
   * 4. Always release the lock in `finally`.
   * A Postgres exclusion constraint acts as a last line of defence
   * in case the lock TTL expires while a request is still running.
   */
  async create(dto: CreateBookingDto, user: AuthenticatedUser) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('startTime phải nhỏ hơn endTime');
    }
    if (startTime.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Không thể đặt lịch trong quá khứ');
    }

    const resource = await this.prisma.resource.findUnique({ where: { id: dto.resourceId } });
    if (!resource) {
      throw new NotFoundException(`Tài nguyên với ID "${dto.resourceId}" không tồn tại`);
    }
    if (resource.status !== 'AVAILABLE') {
      throw new BadRequestException(`Tài nguyên đang ở trạng thái ${resource.status}, không thể đặt`);
    }

    const lockKey = `lock:resource:${dto.resourceId}`;
    const lock = await this.redis.acquireLock(lockKey, {
      ttlMs: LOCK_TTL_MS,
      retryCount: LOCK_RETRY_COUNT,
      retryDelayMs: LOCK_RETRY_DELAY_MS,
    });

    if (!lock) {
      throw new ConflictException('Tài nguyên đang được xử lý bởi giao dịch khác, vui lòng thử lại');
    }

    try {
      const conflict = await this.prisma.booking.findFirst({
        where: {
          resourceId: dto.resourceId,
          status: { not: 'CANCELLED' },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true, startTime: true, endTime: true },
      });

      if (conflict) {
        throw new ConflictException({
          message: 'Khung giờ này đã có người đặt',
          conflictingBooking: conflict,
        });
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            userId: user.id,
            resourceId: dto.resourceId,
            startTime,
            endTime,
            title: dto.title?.trim() || null,
            notes: dto.notes?.trim() || null,
            status: 'CONFIRMED',
          },
          include: bookingInclude,
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'BOOKING_CREATE',
            entityType: 'Booking',
            entityId: booking.id,
            payload: {
              resourceId: booking.resourceId,
              startTime: booking.startTime.toISOString(),
              endTime: booking.endTime.toISOString(),
            },
          },
        });

        return booking;
      });

      // Dispatch notification to BullMQ queue asynchronously (non-blocking)
      void this.notificationsProducer.sendBookingConfirmation({
        bookingId: created.id,
        userId: created.user.id,
        userEmail: created.user.email,
        userName: created.user.fullName,
        resourceName: created.resource.name,
        resourceLocation: created.resource.location,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime.toISOString(),
        title: created.title,
        type: 'CONFIRMED',
      });

      return created;
    } catch (error) {
      if (this.isOverlapViolation(error)) {
        throw new ConflictException('Khung giờ này đã có người đặt');
      }
      throw error;
    } finally {
      const released = await this.redis.releaseLock(lock);
      if (!released) {
        this.logger.warn(`Lock ${lockKey} had already expired before release`);
      }
    }
  }

  async findAll(query: QueryBookingDto, user: AuthenticatedUser) {
    const { resourceId, status, from, to, page = 1, limit = 20 } = query;

    const where: Prisma.BookingWhereInput = {
      ...(resourceId && { resourceId }),
      ...(status && { status }),
      ...(from && { endTime: { gt: new Date(from) } }),
      ...(to && { startTime: { lt: new Date(to) } }),
    };

    // Employees can only see their own bookings
    if (user.role === 'EMPLOYEE') {
      where.userId = user.id;
    }

    const [total, data] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude });
    if (!booking) {
      throw new NotFoundException(`Booking với ID "${id}" không tồn tại`);
    }
    if (user.role === 'EMPLOYEE' && booking.userId !== user.id) {
      throw new ForbiddenException('Bạn chỉ có thể xem lịch đặt của chính mình');
    }
    return booking;
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException(`Booking với ID "${id}" không tồn tại`);
    }

    const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER';
    if (!isPrivileged && booking.userId !== user.id) {
      throw new ForbiddenException('Bạn chỉ có thể hủy lịch đặt của chính mình');
    }
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Lịch đặt này đã bị hủy trước đó');
    }
    if (booking.endTime <= new Date()) {
      throw new BadRequestException('Không thể hủy lịch đặt đã kết thúc');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: bookingInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'BOOKING_CANCEL',
          entityType: 'Booking',
          entityId: id,
          payload: { previousStatus: booking.status, cancelledBy: user.role },
        },
      });

      return cancelledBooking;
    });

    // Dispatch cancellation notification asynchronously
    void this.notificationsProducer.sendBookingCancellation({
      bookingId: cancelled.id,
      userId: cancelled.user.id,
      userEmail: cancelled.user.email,
      userName: cancelled.user.fullName,
      resourceName: cancelled.resource.name,
      resourceLocation: cancelled.resource.location,
      startTime: cancelled.startTime.toISOString(),
      endTime: cancelled.endTime.toISOString(),
      title: cancelled.title,
      type: 'CANCELLED',
    });

    return cancelled;
  }

  private isOverlapViolation(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.includes(OVERLAP_CONSTRAINT) || error.message.includes('23P01');
  }
}
