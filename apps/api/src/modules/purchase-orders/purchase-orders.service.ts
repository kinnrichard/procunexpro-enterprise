import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.purchaseOrder.count({
      where: {
        tenantId,
        orderNumber: { startsWith: prefix },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string; priority?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;

    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
          purchaseRequest: {
            select: { id: true, requestNumber: true, title: true },
          },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        purchaseRequest: {
          select: { id: true, requestNumber: true, title: true },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
          },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async create(tenantId: string, userId: string, data: any) {
    const orderNumber = await this.generateOrderNumber(tenantId);

    const items = (data.items || []).map((item: any) => ({
      productId: item.productId,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
      notes: item.notes || null,
    }));

    const subtotal = items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const taxAmount = data.taxAmount || 0;
    const shippingCost = data.shippingCost || 0;
    const totalAmount = subtotal + taxAmount + shippingCost;

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        orderNumber,
        vendorId: data.vendorId,
        createdById: userId,
        purchaseRequestId: data.purchaseRequestId || null,
        status: 'DRAFT',
        priority: data.priority || 'MEDIUM',
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        subtotal,
        taxAmount,
        shippingCost,
        totalAmount,
        paymentTerms: data.paymentTerms || null,
        shippingAddress: data.shippingAddress || null,
        notes: data.notes || null,
        items: { create: items },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') {
      throw new BadRequestException('Can only edit purchase orders in DRAFT status');
    }

    if (data.items) {
      await this.prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      const items = data.items.map((item: any) => ({
        purchaseOrderId: id,
        productId: item.productId,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes || null,
      }));

      await this.prisma.purchaseOrderItem.createMany({ data: items });

      const subtotal = items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      data.subtotal = subtotal;
      data.totalAmount = subtotal + (data.taxAmount ?? po.taxAmount) + (data.shippingCost ?? po.shippingCost);
    }

    const updateData: any = {};
    if (data.vendorId !== undefined) updateData.vendorId = data.vendorId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.expectedDate !== undefined) updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
    if (data.shippingCost !== undefined) updateData.shippingCost = data.shippingCost;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
    if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete purchase orders in DRAFT status');
    }
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { message: 'Purchase order deleted' };
  }

  async submit(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') {
      throw new BadRequestException('Can only submit purchase orders in DRAFT status');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(tenantId: string, id: string, approvedBy: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Can only approve purchase orders in PENDING_APPROVAL status');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });
  }

  async send(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'APPROVED') {
      throw new BadRequestException('Can only send purchase orders in APPROVED status');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async receive(tenantId: string, id: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new BadRequestException('Can only receive purchase orders in SENT or PARTIALLY_RECEIVED status');
    }

    // Update product stock and create stock movements for each item
    const today = new Date();
    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < po.items.length; i++) {
      const item = po.items[i];
      const remainingQty = item.quantity - item.receivedQty;
      if (remainingQty <= 0) continue;

      // Update product stock
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: remainingQty } },
      });

      // Update received qty on item
      await this.prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.quantity },
      });

      // Create stock movement
      const smCount = await this.prisma.stockMovement.count({
        where: { tenantId, referenceNumber: { startsWith: smPrefix } },
      });

      await this.prisma.stockMovement.create({
        data: {
          tenantId,
          referenceNumber: `${smPrefix}-${String(smCount + i + 1).padStart(4, '0')}`,
          productId: item.productId,
          type: 'PURCHASE',
          quantity: remainingQty,
          purchaseOrderId: po.id,
          reason: `Received from PO ${po.orderNumber}`,
          performedBy: userId,
        },
      });
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
        deliveryDate: new Date(),
      },
    });
  }
}
