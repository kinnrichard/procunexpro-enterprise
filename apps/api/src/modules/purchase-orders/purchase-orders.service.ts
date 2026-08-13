import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
            product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true, pricings: { select: { vendorId: true, originalPackagingQty: true, pcsPerPack: true, originalPackagingUom: true } } } },
          },
          orderBy: { createdAt: 'asc' },
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

  async createFromPrItems(tenantId: string, userId: string, data: { itemIds: string[]; priority?: string; expectedDate?: string; paymentTerms?: string; shippingAddress?: string; notes?: string }) {
    // Fetch the selected PR line items with their PR and vendor info
    const prItems = await this.prisma.purchaseRequestItem.findMany({
      where: {
        id: { in: data.itemIds },
        purchaseRequest: { tenantId, status: { in: ['PROCUREMENT', 'COMPLETED'] } },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        vendor: { select: { id: true, name: true } },
        purchaseRequest: { select: { id: true, requestNumber: true } },
      },
    });

    if (prItems.length === 0) throw new BadRequestException('No valid approved PR items found');

    // Group items by vendor
    const byVendor = new Map<string, typeof prItems>();
    for (const item of prItems) {
      const vendorId = item.vendorId || 'no-vendor';
      const group = byVendor.get(vendorId) || [];
      group.push(item);
      byVendor.set(vendorId, group);
    }

    // Items without vendor cannot be converted
    if (byVendor.has('no-vendor')) {
      throw new BadRequestException('Some items have no vendor assigned. Assign vendors before creating POs.');
    }

    // Create one PO per vendor
    const createdPOs: any[] = [];
    for (const [vendorId, vendorItems] of byVendor.entries()) {
      const orderNumber = await this.generateOrderNumber(tenantId);
      const poItems = vendorItems.map((item) => ({
        product: { connect: { id: item.productId! } },
        description: item.product?.name || item.description,
        uom: item.uom || 'pcs',
        quantity: item.quantity,
        unitPrice: item.estimatedPrice || 0,
        discount: item.discount || 0,
        taxable: item.taxable || false,
        taxIncluded: item.taxIncluded || false,
        glAccountId: item.glAccountId || null,
        debitAmount: item.debitAmount || 0,
        creditAmount: item.creditAmount || 0,
        accountRemarks: item.accountRemarks || null,
        totalPrice: item.totalPrice || 0,
        notes: item.notes || null,
      }));

      const subtotal = poItems.reduce((sum, i) => sum + i.totalPrice, 0);
      const prIds = [...new Set(vendorItems.map(i => i.purchaseRequest.id))];

      const po = await this.prisma.purchaseOrder.create({
        data: {
          tenantId,
          orderNumber,
          vendorId,
          createdById: userId,
          purchaseRequestId: prIds.length === 1 ? prIds[0] : null,
          status: 'DRAFT',
          priority: (data.priority as Priority) || 'MEDIUM',
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          subtotal,
          taxAmount: 0,
          shippingCost: 0,
          totalAmount: subtotal,
          paymentTerms: data.paymentTerms || null,
          shippingAddress: data.shippingAddress || null,
          notes: data.notes || null,
          items: { create: poItems },
        },
        include: {
          vendor: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });
      createdPOs.push(po);
    }

    // Mark PRs as COMPLETED if all items have been converted to POs
    const affectedPrIds = [...new Set(prItems.map(i => i.purchaseRequest.id))];
    for (const prId of affectedPrIds) {
      const allItems = await this.prisma.purchaseRequestItem.findMany({ where: { purchaseRequestId: prId } });
      const allConverted = allItems.every(item => data.itemIds.includes(item.id));
      if (allConverted) {
        await this.prisma.purchaseRequest.update({
          where: { id: prId },
          data: { status: 'COMPLETED', procurementSubStatus: 'COMPLETED' },
        });
      }
    }

    return { created: createdPOs.length, purchaseOrders: createdPOs };
  }

  async updateItem(tenantId: string, poId: string, itemId: string, data: any) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') throw new BadRequestException('Can only edit items in draft orders');

    const existing = await this.prisma.purchaseOrderItem.findFirst({ where: { id: itemId, purchaseOrderId: poId } });
    if (!existing) throw new NotFoundException('Item not found');

    const updateData: any = {};
    const fields = ['quantity', 'unitPrice', 'discount', 'taxable', 'taxIncluded', 'glAccountId', 'debitAmount', 'creditAmount', 'accountRemarks', 'notes'];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    // Recalc totalPrice
    const qty = updateData.quantity ?? existing.quantity;
    const price = updateData.unitPrice ?? existing.unitPrice;
    updateData.totalPrice = qty * price;

    const item = await this.prisma.purchaseOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    // Recalc PO totals
    const allItems = await this.prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } });
    const subtotal = allItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { subtotal, totalAmount: subtotal + (po.taxAmount || 0) + (po.shippingCost || 0) },
    });

    return item;
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
      include: { items: { include: { product: { select: { qcRequired: true } } } } },
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

      // Create a stock lot for the received quantity (expiry can be set later)
      await this.prisma.stockLot.create({
        data: {
          tenantId,
          productId: item.productId,
          lotNumber: `${po.orderNumber}-${item.id.slice(-4)}`,
          quantity: remainingQty,
          initialQty: remainingQty,
          source: `PO ${po.orderNumber}`,
          status: 'AVAILABLE',
          qcStatus: item.product?.qcRequired ? 'PENDING' : 'PASSED',
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
