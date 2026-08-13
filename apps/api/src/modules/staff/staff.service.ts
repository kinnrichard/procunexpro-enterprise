import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const EDITABLE = ['employeeId', 'firstName', 'lastName', 'position', 'departmentId', 'email', 'phone', 'userId', 'hireDate', 'isActive', 'notes'];

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    department: { select: { id: true, name: true } },
    user: { select: { id: true, username: true, role: true } },
  };

  async findAll(
    tenantId: string,
    params: {
      page?: number; limit?: number; search?: string; status?: string;
      departmentId?: string; createdDateFrom?: string; createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) where.isActive = params.status === 'ACTIVE';
    if (params.departmentId) where.departmentId = params.departmentId;

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { employeeId: { contains: params.search, mode: 'insensitive' } },
        { position: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.staff.findMany({ where, skip, take: limit, orderBy: { lastName: 'asc' }, include: this.include }),
      this.prisma.staff.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // Login accounts not yet linked to any staff (for the link dropdown)
  async availableUsers(tenantId: string, currentUserId?: string) {
    const linked = await this.prisma.staff.findMany({
      where: { tenantId, userId: { not: null }, ...(currentUserId ? { userId: { not: currentUserId } } : {}) },
      select: { userId: true },
    });
    const takenIds = linked.map((s) => s.userId).filter(Boolean) as string[];
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, id: { notIn: takenIds } },
      select: { id: true, username: true, firstName: true, lastName: true, role: true },
      orderBy: { username: 'asc' },
    });
    return { data: users };
  }

  private normalize(data: any) {
    const out: any = {};
    for (const f of EDITABLE) {
      if (data[f] === undefined) continue;
      if (f === 'userId' || f === 'departmentId') out[f] = data[f] || null;
      else if (f === 'hireDate') out[f] = data[f] ? new Date(data[f]) : null;
      else out[f] = data[f] === '' ? null : data[f];
    }
    return out;
  }

  async create(tenantId: string, data: any) {
    if (!data.employeeId) throw new ConflictException('Employee ID is required');
    const existing = await this.prisma.staff.findFirst({ where: { tenantId, employeeId: data.employeeId } });
    if (existing) throw new ConflictException('A staff member with this Employee ID already exists');
    if (data.userId) await this.assertUserFree(tenantId, data.userId);

    return this.prisma.staff.create({ data: { tenantId, ...this.normalize(data) }, include: this.include });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.staff.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Staff not found');

    if (data.employeeId && data.employeeId !== item.employeeId) {
      const dup = await this.prisma.staff.findFirst({ where: { tenantId, employeeId: data.employeeId, id: { not: id } } });
      if (dup) throw new ConflictException('A staff member with this Employee ID already exists');
    }
    if (data.userId) await this.assertUserFree(tenantId, data.userId, id);

    return this.prisma.staff.update({ where: { id }, data: this.normalize(data), include: this.include });
  }

  private async assertUserFree(tenantId: string, userId: string, excludeStaffId?: string) {
    const linked = await this.prisma.staff.findFirst({ where: { tenantId, userId, ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}) } });
    if (linked) throw new ConflictException('That user account is already linked to another staff member');
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.staff.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Staff not found');
    await this.prisma.staff.delete({ where: { id } });
    return { message: 'Staff deleted' };
  }
}
