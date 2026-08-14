import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      country?: string;
      paymentTerms?: string;
      createdDateFrom?: string;
      createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.country) {
      where.country = { contains: params.country, mode: 'insensitive' };
    }

    if (params.paymentTerms) {
      where.paymentTerms = { contains: params.paymentTerms, mode: 'insensitive' };
    }

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
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
    // Vendor code is always system-generated (VND-0001, VND-0002, …); any
    // client-supplied code is ignored. Retry on the rare unique-constraint race.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.generateCode(tenantId);
      try {
        return await this.prisma.vendor.create({
          data: {
            tenantId,
            name: data.name,
            code,
            contactPerson: data.contactPerson || null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            province: data.province || null,
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
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 4) continue; // code collided, try next
        throw e;
      }
    }
    throw new ConflictException('Could not allocate a vendor code, please retry');
  }

  private async generateCode(tenantId: string): Promise<string> {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId, code: { startsWith: 'VND-' } },
      select: { code: true },
    });
    let max = 0;
    for (const v of vendors) {
      const n = Number.parseInt(v.code.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return `VND-${String(max + 1).padStart(4, '0')}`;
  }

  async update(tenantId: string, id: string, data: any) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const updateData: any = {};
    // 'code' is intentionally omitted — vendor codes are system-generated and immutable.
    const fields = [
      'name', 'contactPerson', 'email', 'phone', 'address',
      'city', 'province', 'country', 'website', 'taxId', 'status', 'paymentTerms',
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
