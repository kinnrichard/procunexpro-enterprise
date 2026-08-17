import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../common/services/email.service';
import { ApprovalsService } from '../approvals/approvals.service';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly approvals: ApprovalsService,
  ) {}

  private generateRfqNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return `RFQ-${datePart}-${rand}`;
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number; limit?: number; search?: string; status?: string;
      vendorId?: string; createdDateFrom?: string; createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.vendorId) where.vendorId = params.vendorId;

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { rfqNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rfqs, total] = await Promise.all([
      this.prisma.rFQ.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true, quotes: true } },
        },
      }),
      this.prisma.rFQ.count({ where }),
    ]);

    // Resolve createdBy user names
    const userIds = rfqs.map((r) => r.createdBy).filter(Boolean) as string[];
    const uniqueUserIds = [...new Set(userIds)];
    const users = uniqueUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const approvals = await this.approvals.getRequestsMap(tenantId, 'RFQ', rfqs.map((r) => r.id));
    const data = rfqs.map((rfq) => ({
      ...rfq,
      createdByName: rfq.createdBy ? userMap.get(rfq.createdBy) || null : null,
      approval: approvals.get(rfq.id) || null,
    }));

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        vendor: { select: { id: true, name: true, email: true } },
        purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
        quotes: {
          include: {
            vendor: { select: { id: true, name: true } },
            items: {
              include: {
                rfqItem: true,
              },
            },
          },
        },
        vendorTokens: {
          select: { token: true, vendorId: true, usedAt: true, expiresAt: true },
        },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    // Resolve createdBy user
    let createdByUser: { id: string; firstName: string; lastName: string } | null = null;
    if (rfq.createdBy) {
      createdByUser = await this.prisma.user.findUnique({
        where: { id: rfq.createdBy },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    // Build vendor response URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
    const vendorResponseUrl = rfq.vendorTokens?.[0]
      ? `${frontendUrl}/rfq/respond/${rfq.vendorTokens[0].token}`
      : null;

    const approval = await this.approvals.getRequest(tenantId, 'RFQ', id);

    return { ...rfq, createdByUser, vendorResponseUrl, approval };
  }

  async create(tenantId: string, data: any, createdBy?: string) {
    const rfqNumber = this.generateRfqNumber();
    const { items, ...rfqData } = data;

    return this.prisma.rFQ.create({
      data: {
        tenantId,
        rfqNumber,
        title: rfqData.title,
        description: rfqData.description || null,
        status: 'DRAFT',
        deadline: rfqData.deadline ? new Date(rfqData.deadline) : null,
        createdBy: createdBy || null,
        notes: rfqData.notes || null,
        items: items?.length
          ? {
              create: items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'pcs',
                notes: item.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
        _count: { select: { quotes: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT RFQs can be updated');
    }

    const { items, ...rfqData } = data;

    return this.prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.rFQItem.deleteMany({ where: { rfqId: id } });
        if (items.length > 0) {
          await tx.rFQItem.createMany({
            data: items.map((item: any) => ({
              rfqId: id,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit || 'pcs',
              notes: item.notes || null,
            })),
          });
        }
      }

      const updateData: any = {};
      if (rfqData.title !== undefined) updateData.title = rfqData.title;
      if (rfqData.description !== undefined) updateData.description = rfqData.description;
      if (rfqData.deadline !== undefined) updateData.deadline = rfqData.deadline ? new Date(rfqData.deadline) : null;
      if (rfqData.notes !== undefined) updateData.notes = rfqData.notes;

      return tx.rFQ.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          _count: { select: { quotes: true } },
        },
      });
    });
  }

  async delete(tenantId: string, id: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT RFQs can be deleted');
    }
    await this.prisma.rFQ.delete({ where: { id } });
    return { message: 'RFQ deleted' };
  }

  /**
   * Publishing an RFQ (which emails vendors) is gated by the RFQ approval workflow.
   * If a workflow is configured, the first call submits the RFQ for approval and it
   * only goes out once fully approved (via approve()). No workflow → publishes now.
   */
  async publish(tenantId: string, id: string, userId?: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId }, include: { items: { select: { id: true } } } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Only draft RFQs can be published');
    if (rfq.items.length === 0) throw new BadRequestException('Cannot publish an RFQ with no items');

    // Already approved (e.g. re-clicking Publish after approval) → send it out.
    const existing = await this.approvals.getRequest(tenantId, 'RFQ', id);
    if (existing?.status === 'APPROVED') return this.doPublish(tenantId, id);

    const { required } = await this.approvals.ensureRequest(tenantId, 'RFQ', id, userId);
    if (!required) return this.doPublish(tenantId, id);

    // Submitted for approval — RFQ stays DRAFT until fully approved.
    return this.findOne(tenantId, id);
  }

  /** Records an approval on the current stage; publishes the RFQ once fully approved. */
  async approve(tenantId: string, id: string, userId: string, userRole: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId }, select: { status: true } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') throw new BadRequestException('This RFQ is no longer awaiting approval');
    const outcome = await this.approvals.decide(tenantId, 'RFQ', id, userId, userRole, 'APPROVED');
    if (outcome.approved) await this.doPublish(tenantId, id);
    return this.findOne(tenantId, id);
  }

  /** Rejects the RFQ at the current stage; it stays in DRAFT. */
  async reject(tenantId: string, id: string, userId: string, userRole: string, reason?: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId }, select: { status: true } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') throw new BadRequestException('This RFQ is no longer awaiting approval');
    await this.approvals.decide(tenantId, 'RFQ', id, userId, userRole, 'REJECTED', reason);
    return this.findOne(tenantId, id);
  }

  /** The actual publish: flips to PUBLISHED and emails the vendor a response link. */
  private async doPublish(tenantId: string, id: string) {
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id, tenantId },
      include: {
        vendor: { select: { id: true, name: true, email: true } },
        items: true,
        tenant: { select: { companyName: true } },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.items.length === 0) throw new BadRequestException('Cannot publish an RFQ with no items');

    const updated = await this.prisma.rFQ.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    // Generate vendor token and send email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
    const emailResults: any[] = [];

    if (rfq.vendor) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.rFQVendorToken.create({
        data: {
          rfqId: id,
          vendorId: rfq.vendor.id,
          token,
          expiresAt: rfq.deadline || null,
        },
      });

      if (rfq.vendor.email) {
        const result = await this.emailService.sendRfqInvitation({
          to: rfq.vendor.email,
          vendorName: rfq.vendor.name,
          rfqNumber: rfq.rfqNumber,
          rfqTitle: rfq.title,
          deadline: rfq.deadline ? rfq.deadline.toISOString().split('T')[0] : undefined,
          responseUrl: `${frontendUrl}/rfq/respond/${token}`,
          companyName: rfq.tenant?.companyName || 'Procunex',
        });
        emailResults.push({ vendor: rfq.vendor.name, ...result });
      }
    }

    return { ...updated, emailResults };
  }

  async close(tenantId: string, id: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return this.prisma.rFQ.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async addQuote(tenantId: string, rfqId: string, data: any) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const { items, ...quoteData } = data;

    // Look up the RFQ items to get quantities for price calculations
    const rfqItems = await this.prisma.rFQItem.findMany({ where: { rfqId } });
    const rfqItemMap = new Map(rfqItems.map((i) => [i.id, i]));

    // Calculate totalAmount from items
    let totalAmount = 0;
    if (items?.length) {
      for (const item of items) {
        const rfqItem = rfqItemMap.get(item.rfqItemId);
        if (rfqItem) {
          totalAmount += item.unitPrice * rfqItem.quantity;
        }
      }
    }

    return this.prisma.rFQQuote.create({
      data: {
        rfqId,
        vendorId: quoteData.vendorId,
        totalAmount,
        leadTime: quoteData.leadTime || null,
        validUntil: quoteData.validUntil ? new Date(quoteData.validUntil) : null,
        isAwarded: false,
        notes: quoteData.notes || null,
        submittedAt: new Date(),
        items: items?.length
          ? {
              create: items.map((item: any) => {
                const rfqItem = rfqItems.find((ri) => ri.id === item.rfqItemId);
                const qty = rfqItem ? rfqItem.quantity : 1;
                return {
                  rfqItemId: item.rfqItemId,
                  unitPrice: item.unitPrice || 0,
                  totalPrice: (item.unitPrice || 0) * qty,
                  notes: item.notes || null,
                };
              }),
            }
          : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        items: { include: { rfqItem: true } },
      },
    });
  }

  async updateQuote(tenantId: string, rfqId: string, quoteId: string, data: any) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const quote = await this.prisma.rFQQuote.findFirst({ where: { id: quoteId, rfqId } });
    if (!quote) throw new NotFoundException('Quote not found');

    const updateData: any = {};
    if (data.leadTime !== undefined) updateData.leadTime = data.leadTime;
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;

    return this.prisma.rFQQuote.update({
      where: { id: quoteId },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
        items: { include: { rfqItem: true } },
      },
    });
  }

  async award(tenantId: string, rfqId: string, quoteId: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const quote = await this.prisma.rFQQuote.findFirst({ where: { id: quoteId, rfqId } });
    if (!quote) throw new NotFoundException('Quote not found');

    return this.prisma.$transaction(async (tx) => {
      // Only one quote can be awarded per RFQ
      await tx.rFQQuote.updateMany({ where: { rfqId }, data: { isAwarded: false } });
      await tx.rFQQuote.update({ where: { id: quoteId }, data: { isAwarded: true } });

      // If this RFQ came from a PR, push the awarded price + vendor back onto the PR.
      let prSync: { updatedItems: number; pricingsChanged: number } | null = null;
      if (rfq.purchaseRequestId) {
        prSync = await this.applyAwardToPurchaseRequest(tx, rfq.purchaseRequestId, quoteId);
      }

      const updated = await tx.rFQ.update({
        where: { id: rfqId },
        data: { status: 'AWARDED', awardedAt: new Date() },
        include: {
          items: true,
          quotes: {
            include: {
              vendor: { select: { id: true, name: true } },
              items: { include: { rfqItem: true } },
            },
          },
        },
      });
      return { ...updated, prSync };
    });
  }

  /**
   * After an RFQ that was created from a PR is awarded, reflect the winning quote
   * back onto the source PR: for each awarded line whose price (or vendor) differs
   * from the PR item, update the PR item's price + vendor and upsert the vendor's
   * ProductPricing ("add a new price"). RFQ items are created from the PR item's
   * product name/description, so items are matched by description.
   */
  private async applyAwardToPurchaseRequest(tx: any, purchaseRequestId: string, quoteId: string) {
    const quote = await tx.rFQQuote.findUnique({
      where: { id: quoteId },
      include: { items: { include: { rfqItem: true } } },
    });
    if (!quote) return { updatedItems: 0, pricingsChanged: 0 };
    const vendorId: string = quote.vendorId;

    const prItems = await tx.purchaseRequestItem.findMany({
      where: { purchaseRequestId },
      include: { product: { select: { id: true, name: true } } },
    });

    const norm = (s?: string | null) => (s || '').trim().toLowerCase();
    const used = new Set<string>();
    let updatedItems = 0;
    let pricingsChanged = 0;

    for (const qi of quote.items) {
      const desc = norm(qi.rfqItem?.description);
      const price: number = qi.unitPrice || 0;

      const candidates = prItems.filter(
        (pi: any) => !used.has(pi.id) && norm(pi.product?.name || pi.description) === desc,
      );
      const target =
        candidates.find((c: any) => c.vendorId === vendorId) ||
        candidates.find((c: any) => !c.vendorId) ||
        candidates[0];
      if (!target) continue;

      const priceChanged = Math.abs((target.estimatedPrice || 0) - price) > 1e-9;
      const vendorChanged = target.vendorId !== vendorId;
      if (!priceChanged && !vendorChanged) continue; // PR already matches the award
      used.add(target.id);

      // Record/refresh the vendor's price for this product ("add a new price"),
      // preserving existing packaging (pcsPerPack) when the pricing already exists.
      let pcsPerPack = 1;
      if (target.productId) {
        const existing = await tx.productPricing.findUnique({
          where: { productId_vendorId: { productId: target.productId, vendorId } },
        });
        if (!existing) {
          await tx.productPricing.create({
            data: { productId: target.productId, vendorId, unitCost: price, sellingPrice: price },
          });
          pricingsChanged++;
        } else {
          pcsPerPack = existing.pcsPerPack || 1;
          if (Math.abs((existing.unitCost || 0) - price) > 1e-9) {
            await tx.productPricing.update({ where: { id: existing.id }, data: { unitCost: price } });
            pricingsChanged++;
          }
        }
      }

      const invQty = (target.quantity || 0) * pcsPerPack;
      await tx.purchaseRequestItem.update({
        where: { id: target.id },
        data: { estimatedPrice: price, vendorId, totalPrice: invQty * price },
      });
      updatedItems++;
    }

    if (updatedItems > 0) {
      const items = await tx.purchaseRequestItem.findMany({
        where: { purchaseRequestId },
        select: { totalPrice: true },
      });
      const totalAmount = items.reduce((s: number, i: any) => s + (i.totalPrice || 0), 0);
      await tx.purchaseRequest.update({ where: { id: purchaseRequestId }, data: { totalAmount } });
    }

    return { updatedItems, pricingsChanged };
  }

  async createFromPrItems(
    tenantId: string,
    userId: string,
    data: { itemIds: string[]; title: string; deadline?: string; notes?: string },
  ) {
    if (!data.itemIds?.length) {
      throw new BadRequestException('itemIds are required');
    }

    // Fetch approved PR items
    const prItems = await this.prisma.purchaseRequestItem.findMany({
      where: {
        id: { in: data.itemIds },
        purchaseRequest: { tenantId, status: { in: ['PROCUREMENT', 'COMPLETED'] } },
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
      },
    });

    if (prItems.length === 0) {
      throw new BadRequestException('No valid approved PR items found');
    }

    const rfqNumber = this.generateRfqNumber();

    return this.prisma.rFQ.create({
      data: {
        tenantId,
        rfqNumber,
        title: data.title,
        status: 'DRAFT',
        deadline: data.deadline ? new Date(data.deadline) : null,
        notes: data.notes || null,
        createdBy: userId,
        items: {
          create: prItems.map((item) => ({
            description: item.product?.name || item.description || '',
            quantity: item.quantity,
            unit: item.product?.unit || item.uom || 'pcs',
            notes: null,
          })),
        },
      },
      include: {
        items: true,
        _count: { select: { quotes: true } },
      },
    });
  }

  async createFromPurchaseRequest(
    tenantId: string,
    userId: string,
    data: { purchaseRequestId: string; deadline?: string; notes?: string },
  ) {
    // Fetch the PR and its items
    const pr = await this.prisma.purchaseRequest.findFirst({
      where: { id: data.purchaseRequestId, tenantId, status: 'PROCUREMENT' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
            vendor: { select: { id: true, name: true } },
          },
          orderBy: { itemNumber: 'asc' },
        },
      },
    });

    if (!pr) throw new NotFoundException('Purchase request not found or not in PROCUREMENT status');
    if (pr.items.length === 0) throw new BadRequestException('Purchase request has no items');

    // Group items by vendor
    const byVendor = new Map<string, { vendor: { id: string; name: string }; items: typeof pr.items }>();
    const noVendorItems: typeof pr.items = [];

    for (const item of pr.items) {
      if (item.vendorId && item.vendor) {
        const group = byVendor.get(item.vendorId) || { vendor: item.vendor, items: [] };
        group.items.push(item);
        byVendor.set(item.vendorId, group);
      } else {
        noVendorItems.push(item);
      }
    }

    if (byVendor.size === 0 && noVendorItems.length > 0) {
      // All items have no vendor — create a single RFQ with all items
      const rfqNumber = this.generateRfqNumber();
      const rfq = await this.prisma.rFQ.create({
        data: {
          tenantId,
          purchaseRequestId: pr.id,
          rfqNumber,
          title: `RFQ from ${pr.requestNumber}`,
          status: 'DRAFT',
          deadline: data.deadline ? new Date(data.deadline) : null,
          notes: data.notes || null,
          createdBy: userId,
          items: {
            create: noVendorItems.map((item) => ({
              description: item.product?.name || item.description || '',
              quantity: item.quantity,
              unit: item.product?.unit || item.uom || 'pcs',
              notes: null,
            })),
          },
        },
        include: { items: true, _count: { select: { quotes: true } } },
      });
      return { created: 1, rfqs: [rfq] };
    }

    // Create one RFQ per vendor
    const createdRfqs: any[] = [];

    for (const [vendorId, group] of byVendor.entries()) {
      const rfqNumber = this.generateRfqNumber();
      const rfq = await this.prisma.rFQ.create({
        data: {
          tenantId,
          purchaseRequestId: pr.id,
          vendorId,
          rfqNumber,
          title: `RFQ from ${pr.requestNumber} — ${group.vendor.name}`,
          status: 'DRAFT',
          deadline: data.deadline ? new Date(data.deadline) : null,
          notes: data.notes || null,
          createdBy: userId,
          items: {
            create: group.items.map((item) => ({
              description: item.product?.name || item.description || '',
              quantity: item.quantity,
              unit: item.product?.unit || item.uom || 'pcs',
              notes: null,
            })),
          },
        },
        include: { items: true, _count: { select: { quotes: true } } },
      });
      createdRfqs.push(rfq);
    }

    // If there are items without vendor, create a separate RFQ for them
    if (noVendorItems.length > 0) {
      const rfqNumber = this.generateRfqNumber();
      const rfq = await this.prisma.rFQ.create({
        data: {
          tenantId,
          purchaseRequestId: pr.id,
          rfqNumber,
          title: `RFQ from ${pr.requestNumber} — Unassigned`,
          status: 'DRAFT',
          deadline: data.deadline ? new Date(data.deadline) : null,
          notes: data.notes || null,
          createdBy: userId,
          items: {
            create: noVendorItems.map((item) => ({
              description: item.product?.name || item.description || '',
              quantity: item.quantity,
              unit: item.product?.unit || item.uom || 'pcs',
              notes: null,
            })),
          },
        },
        include: { items: true, _count: { select: { quotes: true } } },
      });
      createdRfqs.push(rfq);
    }

    // Update PR procurement sub-status
    await this.prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { procurementSubStatus: 'WAITING_ON_VENDOR' },
    });

    return { created: createdRfqs.length, rfqs: createdRfqs };
  }

  async addItem(tenantId: string, rfqId: string, data: { description: string; quantity: number; unit: string; notes?: string }) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Items can only be added to DRAFT RFQs');
    }

    return this.prisma.rFQItem.create({
      data: {
        rfqId,
        description: data.description,
        quantity: data.quantity,
        unit: data.unit || 'pcs',
        notes: data.notes || null,
      },
    });
  }

  async updateItem(tenantId: string, rfqId: string, itemId: string, data: { description?: string; quantity?: number; unit?: string; notes?: string }) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Items can only be updated on DRAFT RFQs');
    }

    const item = await this.prisma.rFQItem.findFirst({ where: { id: itemId, rfqId } });
    if (!item) throw new NotFoundException('RFQ item not found');

    const updateData: any = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return this.prisma.rFQItem.update({
      where: { id: itemId },
      data: updateData,
    });
  }

  async deleteItem(tenantId: string, rfqId: string, itemId: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestException('Items can only be deleted from DRAFT RFQs');
    }

    const item = await this.prisma.rFQItem.findFirst({ where: { id: itemId, rfqId } });
    if (!item) throw new NotFoundException('RFQ item not found');

    await this.prisma.rFQItem.delete({ where: { id: itemId } });
    return { message: 'RFQ item deleted' };
  }

  async deleteQuote(tenantId: string, rfqId: string, quoteId: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const quote = await this.prisma.rFQQuote.findFirst({ where: { id: quoteId, rfqId } });
    if (!quote) throw new NotFoundException('Quote not found');

    await this.prisma.rFQQuote.delete({ where: { id: quoteId } });
    return { message: 'Quote deleted' };
  }

  async cancel(tenantId: string, rfqId: string) {
    const rfq = await this.prisma.rFQ.findFirst({ where: { id: rfqId, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status === 'AWARDED') {
      throw new BadRequestException('Cannot cancel an awarded RFQ');
    }

    return this.prisma.rFQ.update({
      where: { id: rfqId },
      data: { status: 'CANCELLED' },
    });
  }

  async compare(tenantId: string, rfqId: string) {
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id: rfqId, tenantId },
      include: {
        items: true,
        quotes: {
          include: {
            vendor: { select: { id: true, name: true } },
            items: true,
          },
        },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    // Build comparison: for each RFQ item, show each vendor's price
    const comparison = rfq.items.map((rfqItem) => {
      const vendorPrices = rfq.quotes.map((quote) => {
        const quoteItem = quote.items.find((qi) => qi.rfqItemId === rfqItem.id);
        return {
          vendorId: quote.vendorId,
          vendorName: quote.vendor.name,
          quoteId: quote.id,
          unitPrice: quoteItem?.unitPrice || null,
          totalPrice: quoteItem?.totalPrice || null,
          isAwarded: quote.isAwarded,
        };
      });

      return {
        rfqItemId: rfqItem.id,
        description: rfqItem.description,
        quantity: rfqItem.quantity,
        unit: rfqItem.unit,
        vendorPrices,
      };
    });

    return {
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      title: rfq.title,
      items: comparison,
      quotes: rfq.quotes.map((q) => ({
        quoteId: q.id,
        vendorId: q.vendorId,
        vendorName: q.vendor.name,
        totalAmount: q.totalAmount,
        leadTime: q.leadTime,
        validUntil: q.validUntil,
        isAwarded: q.isAwarded,
      })),
    };
  }

  // ─── Public Vendor Access (token-based) ─────────────────────

  private async validateToken(token: string) {
    const vendorToken = await this.prisma.rFQVendorToken.findUnique({
      where: { token },
      include: {
        rfq: {
          include: {
            items: true,
            tenant: { select: { companyName: true } },
          },
        },
        vendor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!vendorToken) throw new NotFoundException('Invalid or expired link');
    if (vendorToken.expiresAt && new Date() > vendorToken.expiresAt) {
      throw new BadRequestException('This link has expired');
    }

    return vendorToken;
  }

  async getPublicRfq(token: string) {
    const vendorToken = await this.validateToken(token);
    const { rfq, vendor } = vendorToken;

    // Check if vendor already submitted a quote
    const existingQuote = await this.prisma.rFQQuote.findFirst({
      where: { rfqId: rfq.id, vendorId: vendor.id },
      include: { items: true },
    });

    return {
      rfqNumber: rfq.rfqNumber,
      title: rfq.title,
      description: rfq.description,
      status: rfq.status,
      deadline: rfq.deadline,
      companyName: rfq.tenant?.companyName || 'Procunex',
      vendor: { name: vendor.name },
      items: rfq.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes,
      })),
      submitted: !!existingQuote,
      existingQuote: existingQuote ? {
        totalAmount: existingQuote.totalAmount,
        leadTime: existingQuote.leadTime,
        validUntil: existingQuote.validUntil,
        notes: existingQuote.notes,
        items: existingQuote.items,
      } : null,
    };
  }

  async submitPublicQuote(token: string, data: {
    leadTime?: number;
    validUntil?: string;
    notes?: string;
    items: { rfqItemId: string; unitPrice: number; notes?: string }[];
  }) {
    const vendorToken = await this.validateToken(token);
    const { rfq, vendor } = vendorToken;

    if (rfq.status !== 'PUBLISHED') {
      throw new BadRequestException('This RFQ is no longer accepting quotations');
    }

    // Check for existing quote
    const existing = await this.prisma.rFQQuote.findFirst({
      where: { rfqId: rfq.id, vendorId: vendor.id },
    });
    if (existing) {
      throw new BadRequestException('You have already submitted a quotation for this RFQ');
    }

    // Build quote items with calculated totals
    const rfqItemMap = new Map(rfq.items.map((i) => [i.id, i]));
    let totalAmount = 0;
    const quoteItems = data.items.map((item) => {
      const rfqItem = rfqItemMap.get(item.rfqItemId);
      const qty = rfqItem?.quantity || 1;
      const total = qty * item.unitPrice;
      totalAmount += total;
      return {
        rfqItemId: item.rfqItemId,
        unitPrice: item.unitPrice,
        totalPrice: total,
        notes: item.notes || null,
      };
    });

    const quote = await this.prisma.rFQQuote.create({
      data: {
        rfqId: rfq.id,
        vendorId: vendor.id,
        totalAmount,
        leadTime: data.leadTime || null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        notes: data.notes || null,
        submittedAt: new Date(),
        items: { create: quoteItems },
      },
      include: { items: true },
    });

    // Mark token as used
    await this.prisma.rFQVendorToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return quote;
  }
}
