import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { schemaName: { contains: params.search, mode: 'insensitive' } },
        { domain: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, products: true, departments: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, products: true, departments: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Company not found');
    return tenant;
  }

  async create(data: any) {
    const existing = await this.prisma.tenant.findFirst({
      where: { companyName: data.companyName },
    });
    if (existing) throw new ConflictException('Company name already exists');

    const schemaName = data.schemaName || data.companyName.toLowerCase().replaceAll(/[^a-z0-9]/g, '_');

    return this.prisma.tenant.create({
      data: {
        companyName: data.companyName,
        schemaName,
        domain: data.domain || null,
        logo: data.logo || null,
        status: data.status || 'ACTIVE',
        settings: data.settings || null,
      },
      include: {
        _count: { select: { users: true, products: true, departments: true } },
      },
    });
  }

  async update(id: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company not found');

    if (data.companyName && data.companyName !== tenant.companyName) {
      const duplicate = await this.prisma.tenant.findFirst({
        where: { companyName: data.companyName, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Company name already exists');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.domain !== undefined && { domain: data.domain || null }),
        ...(data.logo !== undefined && { logo: data.logo || null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.settings !== undefined && { settings: data.settings }),
      },
      include: {
        _count: { select: { users: true, products: true, departments: true } },
      },
    });
  }

  async delete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company not found');
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Company deleted' };
  }
}
