import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; entityType?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.entityType) {
      where.entityType = params.entityType;
    }

    if (params.search) {
      where.OR = [
        { fileName: { contains: params.search, mode: 'insensitive' } },
        { entityId: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, companyName: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.document.findMany({
      where: { tenantId, entityType: entityType as any, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, userId: string, data: any) {
    return this.prisma.document.create({
      data: {
        tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize || null,
        mimeType: data.mimeType || null,
        uploadedBy: userId,
      },
    });
  }

  async delete(tenantId: string, userId: string, userRole: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!document) throw new NotFoundException('Document not found');

    // Only the uploader or ADMIN/SUPERADMIN can delete
    if (
      document.uploadedBy !== userId &&
      userRole !== 'ADMIN' &&
      userRole !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException('You can only delete your own documents');
    }

    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted' };
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.document.groupBy({
      by: ['entityType'],
      where: { tenantId },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const stat of stats) {
      result[stat.entityType] = stat._count.id;
    }
    return result;
  }
}
