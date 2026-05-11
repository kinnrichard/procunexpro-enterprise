import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = { id: true, firstName: true, lastName: true, avatar: true };

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.comment.findMany({
      where: { tenantId, entityType, entityId, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: this.userSelect },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: this.userSelect } },
        },
      },
    });
  }

  async create(tenantId: string, userId: string, data: { entityType: string; entityId: string; content: string; parentId?: string }) {
    return this.prisma.comment.create({
      data: {
        tenantId,
        userId,
        entityType: data.entityType,
        entityId: data.entityId,
        content: data.content,
        parentId: data.parentId || null,
      },
      include: {
        user: { select: this.userSelect },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: this.userSelect } },
        },
      },
    });
  }

  private isPrivileged(role: string) {
    return ['SUPERADMIN', 'ADMIN'].includes(role);
  }

  async update(tenantId: string, userId: string, role: string, id: string, content: string) {
    const comment = await this.prisma.comment.findFirst({ where: { id, tenantId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId && !this.isPrivileged(role)) throw new ForbiddenException('You can only edit your own comments');
    return this.prisma.comment.update({
      where: { id },
      data: { content },
      include: {
        user: { select: this.userSelect },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: this.userSelect } },
        },
      },
    });
  }

  async delete(tenantId: string, userId: string, role: string, id: string) {
    const comment = await this.prisma.comment.findFirst({ where: { id, tenantId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId && !this.isPrivileged(role)) throw new ForbiddenException('You can only delete your own comments');
    await this.prisma.comment.deleteMany({ where: { parentId: id } });
    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Comment deleted' };
  }
}
