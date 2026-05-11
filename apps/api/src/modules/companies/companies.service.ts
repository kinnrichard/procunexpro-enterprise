import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.company.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.company.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.company.findFirst({ where: { tenantId, name: data.name } });
    if (existing) throw new ConflictException('Company already exists');
    return this.prisma.company.create({ data: { tenantId, name: data.name, isActive: data.isActive ?? true } });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.company.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Company not found');
    if (data.name && data.name !== item.name) {
      const dup = await this.prisma.company.findFirst({ where: { tenantId, name: data.name, id: { not: id } } });
      if (dup) throw new ConflictException('Company already exists');
    }
    return this.prisma.company.update({ where: { id }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.company.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Company not found');
    await this.prisma.company.delete({ where: { id } });
    return { message: 'Company deleted' };
  }
}
