import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const EDITABLE_FIELDS = ['name', 'code', 'contactPerson', 'email', 'phone', 'address', 'city', 'country', 'taxId', 'notes', 'isActive'];

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; status?: string; city?: string; createdDateFrom?: string; createdDateTo?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { contactPerson: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.status === 'ACTIVE') where.isActive = true;
    else if (params.status === 'INACTIVE') where.isActive = false;
    if (params.city) where.city = { contains: params.city, mode: 'insensitive' };
    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.customer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, address: true, contactPerson: true },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    if (!data.code) throw new ConflictException('Customer code is required');
    const existing = await this.prisma.customer.findFirst({ where: { tenantId, code: data.code } });
    if (existing) throw new ConflictException('A customer with this code already exists');

    return this.prisma.customer.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        taxId: data.taxId || null,
        notes: data.notes || null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Customer not found');

    if (data.code && data.code !== item.code) {
      const dup = await this.prisma.customer.findFirst({ where: { tenantId, code: data.code, id: { not: id } } });
      if (dup) throw new ConflictException('A customer with this code already exists');
    }

    const updateData: any = {};
    for (const f of EDITABLE_FIELDS) {
      if (data[f] !== undefined) updateData[f] = data[f] === '' ? null : data[f];
    }

    return this.prisma.customer.update({ where: { id }, data: updateData });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Customer not found');
    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Customer deleted' };
  }
}
