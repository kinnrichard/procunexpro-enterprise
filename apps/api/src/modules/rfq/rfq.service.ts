import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private generateRfqNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return `RFQ-${datePart}-${rand}`;
  }

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

    const data = rfqs.map((rfq) => ({
      ...rfq,
      createdByName: rfq.createdBy ? userMap.get(rfq.createdBy) || null : null,
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

    return { ...rfq, createdByUser, vendorResponseUrl };
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

  async publish(tenantId: string, id: string) {
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
      // Set all quotes for this RFQ to not awarded
      await tx.rFQQuote.updateMany({
        where: { rfqId },
        data: { isAwarded: false },
      });

      // Award the selected quote
      await tx.rFQQuote.update({
        where: { id: quoteId },
        data: { isAwarded: true },
      });

      // Update RFQ status
      return tx.rFQ.update({
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
    });
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
