import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FULL_ACCESS_ROLES } from '../permissions/permissions.constants';

/**
 * Modules that support a configurable approval workflow. `enforced` marks the
 * ones whose runtime already consults the engine; the rest are configurable now
 * and will be wired in as each module is migrated.
 */
export const APPROVAL_MODULES = [
  { entityType: 'STOCK_MOVEMENT', label: 'Stock Movements', enforced: true },
  { entityType: 'STOCK_TRANSFER', label: 'Stock Transfers', enforced: true },
  { entityType: 'PURCHASE_REQUEST', label: 'Purchase Requests', enforced: true },
  { entityType: 'PURCHASE_ORDER', label: 'Purchase Orders', enforced: true },
  { entityType: 'RFQ', label: 'Request for Quotation', enforced: true },
  { entityType: 'GOODS_RECEIPT', label: 'Goods Receipt', enforced: true },
  { entityType: 'STOCK_LOT', label: 'Stock Lots & Expiry', enforced: true },
  { entityType: 'PRODUCTION', label: 'Production', enforced: true },
  { entityType: 'DELIVERY', label: 'Deliveries', enforced: true },
];

interface StepSnapshot { order: number; name: string; role: string }

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Configuration ---------------------------------------------------

  /**
   * Approvals are opt-in: modules ship with NO stages. Each module appears in the
   * config with an empty stage list until an admin adds stages, and a module with
   * no stages requires no approval (documents post immediately). No seeding.
   */
  async listWorkflows(tenantId: string) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { tenantId },
      include: { rules: { orderBy: { stepOrder: 'asc' } } },
    });
    const byType = new Map(workflows.map((w) => [w.entityType, w]));
    // Return in the canonical module order, always including every supported module.
    return APPROVAL_MODULES.map((mod) => {
      const w = byType.get(mod.entityType);
      return {
        entityType: mod.entityType,
        label: mod.label,
        enforced: mod.enforced,
        id: w?.id ?? null,
        name: w?.name ?? `${mod.label} Approval`,
        isActive: w?.isActive ?? true,
        steps: (w?.rules ?? []).map((r) => ({ order: r.stepOrder, name: r.name || r.role, role: r.role })),
      };
    });
  }

  async upsertWorkflow(tenantId: string, entityType: string, dto: { name?: string; isActive?: boolean; steps?: { name?: string; role: string }[] }) {
    if (!APPROVAL_MODULES.some((m) => m.entityType === entityType)) {
      throw new BadRequestException(`Unknown module: ${entityType}`);
    }
    const steps = (dto.steps ?? []).filter((s) => s.role);
    const existing = await this.prisma.approvalWorkflow.findFirst({ where: { tenantId, entityType } });

    const workflow = existing
      ? await this.prisma.approvalWorkflow.update({
          where: { id: existing.id },
          data: { name: dto.name ?? existing.name, isActive: dto.isActive ?? existing.isActive },
        })
      : await this.prisma.approvalWorkflow.create({
          data: { tenantId, entityType, name: dto.name || `${entityType} Approval`, isActive: dto.isActive ?? true },
        });

    await this.prisma.approvalWorkflowRule.deleteMany({ where: { workflowId: workflow.id } });
    if (steps.length) {
      await this.prisma.approvalWorkflowRule.createMany({
        data: steps.map((s, i) => ({ workflowId: workflow.id, stepOrder: i + 1, name: s.name || null, role: s.role, isRequired: true })),
      });
    }
    return this.getWorkflow(tenantId, entityType);
  }

  async getWorkflow(tenantId: string, entityType: string) {
    const w = await this.prisma.approvalWorkflow.findFirst({
      where: { tenantId, entityType },
      include: { rules: { orderBy: { stepOrder: 'asc' } } },
    });
    return w;
  }

  // ---- Runtime ---------------------------------------------------------

  /**
   * Starts an approval request for a document if its module has an active
   * workflow with at least one stage. Returns { required } — when false the
   * caller should treat the document as auto-approved.
   */
  async ensureRequest(tenantId: string, entityType: string, entityId: string, userId?: string) {
    const workflow = await this.getWorkflow(tenantId, entityType);
    if (!workflow || !workflow.isActive || workflow.rules.length === 0) {
      return { required: false as const };
    }
    const steps: StepSnapshot[] = workflow.rules.map((r) => ({ order: r.stepOrder, name: r.name || r.role, role: r.role }));
    const request = await this.prisma.approvalRequest.upsert({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      create: { tenantId, entityType, entityId, status: 'PENDING', currentStep: 1, steps: steps as any, createdById: userId || null },
      update: { status: 'PENDING', currentStep: 1, steps: steps as any, createdById: userId || null },
    });
    // Fresh request → clear any prior decisions (e.g. resubmit after reject)
    await this.prisma.approvalDecision.deleteMany({ where: { requestId: request.id } });
    return { required: true as const, request };
  }

  async getRequest(tenantId: string, entityType: string, entityId: string) {
    const req = await this.prisma.approvalRequest.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      include: { decisions: { orderBy: { decidedAt: 'asc' } } },
    });
    return req ? this.decorate(req) : null;
  }

  /** Summary map keyed by entityId for list views. */
  async getRequestsMap(tenantId: string, entityType: string, entityIds: string[]) {
    if (entityIds.length === 0) return new Map<string, any>();
    const reqs = await this.prisma.approvalRequest.findMany({
      where: { tenantId, entityType, entityId: { in: entityIds } },
    });
    return new Map(reqs.map((r) => [r.entityId, this.decorate(r)]));
  }

  private decorate(req: any): any {
    const steps: StepSnapshot[] = Array.isArray(req.steps) ? req.steps : [];
    const currentStep = steps.find((s) => s.order === req.currentStep) || null;
    return {
      id: req.id,
      entityType: req.entityType,
      entityId: req.entityId,
      status: req.status,
      currentStep: req.currentStep,
      totalSteps: steps.length,
      currentRole: currentStep?.role ?? null,
      currentStepName: currentStep?.name ?? null,
      steps,
      decisions: req.decisions ?? undefined,
    };
  }

  canAct(userRole: string, currentRole: string | null): boolean {
    if (FULL_ACCESS_ROLES.includes(userRole)) return true;
    return !!currentRole && userRole === currentRole;
  }

  /**
   * Records a decision on the current stage. Returns the outcome so the caller
   * can apply side effects when finalized+approved.
   */
  async decide(
    tenantId: string,
    entityType: string,
    entityId: string,
    userId: string,
    userRole: string,
    decision: 'APPROVED' | 'REJECTED',
    comment?: string,
  ): Promise<{ status: string; finalized: boolean; approved: boolean; request: any }> {
    const req = await this.prisma.approvalRequest.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (!req) throw new NotFoundException('No approval request for this record');
    if (req.status !== 'PENDING') {
      throw new BadRequestException(`This record is already ${req.status.toLowerCase()}`);
    }

    const steps: StepSnapshot[] = Array.isArray(req.steps) ? (req.steps as any) : [];
    const current = steps.find((s) => s.order === req.currentStep);
    if (!this.canAct(userRole, current?.role ?? null)) {
      throw new ForbiddenException(`This stage requires the ${current?.name || current?.role} role`);
    }

    await this.prisma.approvalDecision.create({
      data: {
        requestId: req.id,
        stepOrder: req.currentStep,
        stepName: current?.name || current?.role || `Step ${req.currentStep}`,
        role: current?.role || userRole,
        decision,
        decidedById: userId,
        comment: comment || null,
      },
    });

    let status = 'PENDING';
    let nextStep = req.currentStep;
    if (decision === 'REJECTED') {
      status = 'REJECTED';
    } else if (req.currentStep >= steps.length) {
      status = 'APPROVED';
    } else {
      nextStep = req.currentStep + 1;
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: req.id },
      data: { status, currentStep: nextStep },
    });

    return {
      status,
      finalized: status !== 'PENDING',
      approved: status === 'APPROVED',
      request: this.decorate({ ...updated, steps }),
    };
  }
}
