import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(params: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    });
  }

  async findAll(
    tenantId: string,
    userId: string,
    params: { page?: number; limit?: number; isRead?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, userId };

    if (params.isRead !== undefined) {
      where.isRead = params.isRead === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(tenantId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async notify(
    tenantId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    userIds?: string[],
  ) {
    let targetUserIds = userIds;

    if (!targetUserIds || targetUserIds.length === 0) {
      // Notify all ADMIN and MANAGER users in tenant
      const users = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ['ADMIN', 'MANAGER'] },
          isActive: true,
        },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    }

    if (targetUserIds.length === 0) return [];

    const notifications = targetUserIds.map((userId) => ({
      tenantId,
      userId,
      type,
      title,
      message,
      link: link || null,
    }));

    await this.prisma.notification.createMany({ data: notifications });
    return { count: notifications.length };
  }
}
