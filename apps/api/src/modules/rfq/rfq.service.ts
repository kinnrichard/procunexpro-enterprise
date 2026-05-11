import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RfqService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [data, total] = await Promise.all([
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

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
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
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
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
    const rfq = await this.prisma.rFQ.findFirst({ where: { id, tenantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return this.prisma.rFQ.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
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
}
