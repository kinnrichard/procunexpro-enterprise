import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GlAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.glAccount.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.glAccount.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.glAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { code: 'asc' } });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.glAccount.findFirst({ where: { tenantId, code: data.code } });
    if (existing) throw new ConflictException('GL Account code already exists');
    return this.prisma.glAccount.create({ data: { tenantId, code: data.code, name: data.name, description: data.description || null, isActive: data.isActive ?? true } });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.glAccount.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('GL Account not found');
    if (data.code && data.code !== item.code) {
      const dup = await this.prisma.glAccount.findFirst({ where: { tenantId, code: data.code, id: { not: id } } });
      if (dup) throw new ConflictException('GL Account code already exists');
    }
    return this.prisma.glAccount.update({ where: { id }, data: { ...(data.code !== undefined && { code: data.code }), ...(data.name !== undefined && { name: data.name }), ...(data.description !== undefined && { description: data.description || null }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.glAccount.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('GL Account not found');
    await this.prisma.glAccount.delete({ where: { id } });
    return { message: 'GL Account deleted' };
  }
}
