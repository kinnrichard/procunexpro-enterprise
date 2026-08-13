import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateContractNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return `CON-${datePart}-${rand}`;
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      vendorId?: string;
      createdDateFrom?: string;
      createdDateTo?: string;
      valueMin?: string;
      valueMax?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.vendorId) {
      where.vendorId = params.vendorId;
    }

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    if (params.valueMin || params.valueMax) {
      where.totalValue = {};
      if (params.valueMin) where.totalValue.gte = Number.parseFloat(params.valueMin);
      if (params.valueMax) where.totalValue.lte = Number.parseFloat(params.valueMax);
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { contractNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: {
        vendor: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async create(tenantId: string, data: any) {
    const contractNumber = this.generateContractNumber();

    return this.prisma.contract.create({
      data: {
        tenantId,
        contractNumber,
        title: data.title,
        vendorId: data.vendorId,
        status: 'DRAFT',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalValue: data.totalValue || 0,
        terms: data.terms || null,
        autoRenew: data.autoRenew || false,
        renewalNoticeDays: data.renewalNoticeDays || 30,
        notes: data.notes || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const contract = await this.prisma.contract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT contracts can be updated');
    }

    const updateData: any = {};
    const fields = ['title', 'vendorId', 'totalValue', 'terms', 'autoRenew', 'renewalNoticeDays', 'notes'];
    for (const field of fields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    return this.prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT contracts can be deleted');
    }
    await this.prisma.contract.delete({ where: { id } });
    return { message: 'Contract deleted' };
  }

  async activate(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contract not found');
    return this.prisma.contract.update({
      where: { id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });
  }

  async terminate(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contract not found');
    return this.prisma.contract.update({
      where: { id },
      data: { status: 'TERMINATED', terminatedAt: new Date() },
    });
  }

  async getExpiring(tenantId: string) {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return this.prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });
  }
}
