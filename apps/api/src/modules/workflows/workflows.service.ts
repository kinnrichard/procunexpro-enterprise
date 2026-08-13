import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: {
      page?: number; limit?: number; search?: string; entityType?: string;
      status?: string; createdDateFrom?: string; createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.entityType) {
      where.entityType = params.entityType;
    }

    if (params.status) {
      where.isActive = params.status === 'ACTIVE';
    }

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.approvalWorkflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { rules: true } },
        },
      }),
      this.prisma.approvalWorkflow.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
      include: {
        rules: { orderBy: { stepOrder: 'asc' } },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(tenantId: string, data: any) {
    return this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        name: data.name,
        entityType: data.entityType,
        minAmount: data.minAmount ?? null,
        maxAmount: data.maxAmount ?? null,
        isActive: data.isActive === undefined ? true : data.isActive,
        rules: {
          create: (data.rules || []).map((rule: any) => ({
            stepOrder: rule.stepOrder,
            role: rule.role,
            isRequired: rule.isRequired === undefined ? true : rule.isRequired,
          })),
        },
      },
      include: {
        rules: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    // Delete old rules and create new ones in a transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.approvalWorkflowRule.deleteMany({ where: { workflowId: id } });

      return tx.approvalWorkflow.update({
        where: { id },
        data: {
          name: data.name === undefined ? undefined : data.name,
          entityType: data.entityType === undefined ? undefined : data.entityType,
          minAmount: data.minAmount === undefined ? undefined : data.minAmount,
          maxAmount: data.maxAmount === undefined ? undefined : data.maxAmount,
          isActive: data.isActive === undefined ? undefined : data.isActive,
          rules: {
            create: (data.rules || []).map((rule: any) => ({
              stepOrder: rule.stepOrder,
              role: rule.role,
              isRequired: rule.isRequired === undefined ? true : rule.isRequired,
            })),
          },
        },
        include: {
          rules: { orderBy: { stepOrder: 'asc' } },
        },
      });
    });
  }

  async delete(tenantId: string, id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    await this.prisma.approvalWorkflow.delete({ where: { id } });
    return { message: 'Workflow deleted' };
  }

  async activate(tenantId: string, id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(tenantId: string, id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getApplicableWorkflow(tenantId: string, entityType: string, amount: number) {
    // Find the most specific active workflow matching entityType and amount range
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: {
        tenantId,
        entityType,
        isActive: true,
      },
      include: {
        rules: { orderBy: { stepOrder: 'asc' } },
      },
    });

    // Prefer specific range match over catch-all
    let bestMatch = null;
    for (const wf of workflows) {
      const minOk = wf.minAmount === null || amount >= wf.minAmount;
      const maxOk = wf.maxAmount === null || amount <= wf.maxAmount;
      if (minOk && maxOk) {
        // A workflow with both min and max is more specific than a catch-all
        if (bestMatch) {
          const bestHasRange = bestMatch.minAmount !== null || bestMatch.maxAmount !== null;
          const currentHasRange = wf.minAmount !== null || wf.maxAmount !== null;
          if (currentHasRange && !bestHasRange) {
            bestMatch = wf;
          }
        } else {
          bestMatch = wf;
        }
      }
    }

    return bestMatch;
  }

  async createApprovalSteps(
    tenantId: string,
    entityType: string,
    entityId: string,
    amount: number,
  ) {
    const workflow = await this.getApplicableWorkflow(tenantId, entityType, amount);
    if (!workflow?.rules.length) return [];

    const steps = workflow.rules.map((rule) => {
      const stepData: any = {
        stepOrder: rule.stepOrder,
        role: rule.role,
      };

      if (entityType === 'PURCHASE_REQUEST') {
        stepData.purchaseRequestId = entityId;
      } else if (entityType === 'PURCHASE_ORDER') {
        stepData.purchaseOrderId = entityId;
      }

      return stepData;
    });

    return this.prisma.$transaction(
      steps.map((step) => this.prisma.approvalStep.create({ data: step })),
    );
  }
}
