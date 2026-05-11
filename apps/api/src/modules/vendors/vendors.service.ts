import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { contactPerson: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.vendor.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new ConflictException('Vendor code already exists');

    return this.prisma.vendor.create({
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
        website: data.website || null,
        taxId: data.taxId || null,
        status: data.status || 'PENDING',
        paymentTerms: data.paymentTerms || null,
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        bankRouting: data.bankRouting || null,
        rating: data.rating || null,
        notes: data.notes || null,
        isActive: data.isActive === undefined ? true : data.isActive,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const updateData: any = {};
    const fields = [
      'name', 'code', 'contactPerson', 'email', 'phone', 'address',
      'city', 'country', 'website', 'taxId', 'status', 'paymentTerms',
      'bankName', 'bankAccount', 'bankRouting', 'rating', 'notes', 'isActive',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    return this.prisma.vendor.update({ where: { id }, data: updateData });
  }

  async delete(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    await this.prisma.vendor.delete({ where: { id } });
    return { message: 'Vendor deleted' };
  }

  async approve(tenantId: string, id: string, approvedBy: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.vendor.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });
  }

  async suspend(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.vendor.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }
}
