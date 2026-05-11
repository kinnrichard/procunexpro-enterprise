import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GlAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; accountType?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (params.accountType) where.accountType = params.accountType;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
        { category: { contains: params.search, mode: 'insensitive' } },
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
    if (existing) throw new ConflictException('Account code already exists');
    return this.prisma.glAccount.create({
      data: {
        tenantId,
        accountType: data.accountType,
        classification: data.classification,
        category: data.category,
        subCategory: data.subCategory || null,
        title: data.title,
        code: data.code,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.glAccount.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Account not found');
    if (data.code && data.code !== item.code) {
      const dup = await this.prisma.glAccount.findFirst({ where: { tenantId, code: data.code, id: { not: id } } });
      if (dup) throw new ConflictException('Account code already exists');
    }
    const fields = ['accountType', 'classification', 'category', 'subCategory', 'title', 'code', 'isActive'];
    const updateData: any = {};
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    return this.prisma.glAccount.update({ where: { id }, data: updateData });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.glAccount.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Account not found');
    await this.prisma.glAccount.delete({ where: { id } });
    return { message: 'Account deleted' };
  }
}
