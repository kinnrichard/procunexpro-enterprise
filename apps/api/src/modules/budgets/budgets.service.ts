import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string; fiscalYear?: number },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.fiscalYear) {
      where.fiscalYear = params.fiscalYear;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { allocations: true } },
        },
      }),
      this.prisma.budget.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: {
        allocations: {
          include: {
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async create(tenantId: string, data: any) {
    const { allocations, ...budgetData } = data;

    return this.prisma.budget.create({
      data: {
        tenantId,
        name: budgetData.name,
        fiscalYear: budgetData.fiscalYear,
        period: budgetData.period || 'YEARLY',
        totalAmount: budgetData.totalAmount || 0,
        spentAmount: 0,
        status: 'DRAFT',
        startDate: new Date(budgetData.startDate),
        endDate: new Date(budgetData.endDate),
        notes: budgetData.notes || null,
        allocations: allocations?.length
          ? {
              create: allocations.map((a: any) => ({
                departmentId: a.departmentId || null,
                categoryId: a.categoryId || null,
                amount: a.amount || 0,
                spentAmount: 0,
                notes: a.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        allocations: {
          include: {
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const budget = await this.prisma.budget.findFirst({ where: { id, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT budgets can be updated');
    }

    const { allocations, ...budgetData } = data;

    return this.prisma.$transaction(async (tx) => {
      if (allocations !== undefined) {
        await tx.budgetAllocation.deleteMany({ where: { budgetId: id } });
        if (allocations.length > 0) {
          await tx.budgetAllocation.createMany({
            data: allocations.map((a: any) => ({
              budgetId: id,
              departmentId: a.departmentId || null,
              categoryId: a.categoryId || null,
              amount: a.amount || 0,
              spentAmount: 0,
              notes: a.notes || null,
            })),
          });
        }
      }

      const updateData: any = {};
      const fields = ['name', 'fiscalYear', 'period', 'totalAmount', 'notes'];
      for (const field of fields) {
        if (budgetData[field] !== undefined) updateData[field] = budgetData[field];
      }
      if (budgetData.startDate) updateData.startDate = new Date(budgetData.startDate);
      if (budgetData.endDate) updateData.endDate = new Date(budgetData.endDate);

      return tx.budget.update({
        where: { id },
        data: updateData,
        include: {
          allocations: {
            include: {
              department: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      });
    });
  }

  async delete(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT budgets can be deleted');
    }
    await this.prisma.budget.delete({ where: { id } });
    return { message: 'Budget deleted' };
  }

  async activate(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (!budget.startDate || !budget.endDate) {
      throw new BadRequestException('Budget must have startDate and endDate to activate');
    }
    return this.prisma.budget.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async close(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');
    return this.prisma.budget.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  async getAllocations(tenantId: string, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');

    return this.prisma.budgetAllocation.findMany({
      where: { budgetId },
      include: {
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  async addAllocation(tenantId: string, budgetId: string, data: any) {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');

    return this.prisma.budgetAllocation.create({
      data: {
        budgetId,
        departmentId: data.departmentId || null,
        categoryId: data.categoryId || null,
        amount: data.amount || 0,
        spentAmount: 0,
        notes: data.notes || null,
      },
      include: {
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  async removeAllocation(tenantId: string, budgetId: string, allocationId: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id: budgetId, tenantId } });
    if (!budget) throw new NotFoundException('Budget not found');

    const allocation = await this.prisma.budgetAllocation.findFirst({
      where: { id: allocationId, budgetId },
    });
    if (!allocation) throw new NotFoundException('Allocation not found');

    await this.prisma.budgetAllocation.delete({ where: { id: allocationId } });
    return { message: 'Allocation removed' };
  }
}
