import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { QueryResourceDto } from './dto/query-resource.dto.js';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryResourceDto) {
    const { search, type, status, minCapacity, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ResourceWhereInput = {};

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { location: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (minCapacity) {
      where.capacity = { gte: minCapacity };
    }

    const [total, data] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: 'CONFIRMED',
            endTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 5,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            title: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!resource) {
      throw new NotFoundException(`Tài nguyên với ID "${id}" không tồn tại`);
    }

    return resource;
  }

  async create(dto: CreateResourceDto, userId: string) {
    const existing = await this.prisma.resource.findFirst({
      where: { name: { equals: dto.name.trim(), mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`Tài nguyên với tên "${dto.name}" đã tồn tại`);
    }

    const resource = await this.prisma.resource.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        capacity: dto.capacity ?? 1,
        status: dto.status ?? 'AVAILABLE',
        location: dto.location?.trim() || null,
        description: dto.description?.trim() || null,
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'RESOURCE_CREATE',
        entityType: 'Resource',
        entityId: resource.id,
        payload: {
          name: resource.name,
          type: resource.type,
          capacity: resource.capacity,
          location: resource.location,
        },
      },
    });

    return resource;
  }

  async update(id: string, dto: UpdateResourceDto, userId: string) {
    const existing = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tài nguyên với ID "${id}" không tồn tại`);
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.resource.findFirst({
        where: {
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(`Tài nguyên với tên "${dto.name}" đã tồn tại`);
      }
    }

    const updated = await this.prisma.resource.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.status && { status: dto.status }),
        ...(dto.location !== undefined && { location: dto.location?.trim() || null }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'RESOURCE_UPDATE',
        entityType: 'Resource',
        entityId: id,
        payload: {
          before: existing,
          after: updated,
        },
      },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tài nguyên với ID "${id}" không tồn tại`);
    }

    // Safety check: Don't allow deletion if there are future confirmed bookings
    const activeBookingsCount = await this.prisma.booking.count({
      where: {
        resourceId: id,
        status: 'CONFIRMED',
        endTime: { gte: new Date() },
      },
    });

    if (activeBookingsCount > 0) {
      throw new BadRequestException(
        `Không thể xóa tài nguyên này vì đang có ${activeBookingsCount} lịch đặt phòng sắp tới. Vui lòng hủy các lịch đặt trước khi xóa.`,
      );
    }

    await this.prisma.resource.delete({
      where: { id },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'RESOURCE_DELETE',
        entityType: 'Resource',
        entityId: id,
        payload: {
          deletedResource: existing,
        },
      },
    });

    return {
      success: true,
      message: `Đã xóa tài nguyên "${existing.name}" thành công`,
      deletedId: id,
    };
  }
}
