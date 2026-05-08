import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PurchaseRequestsService {
  constructor(private prisma: PrismaService) {}

  private async generateRequestNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `PR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.purchaseRequest.count({
      where: {
        tenantId,
        requestNumber: { startsWith: prefix },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private itemIncludes = {
    vendor: { select: { id: true, name: true } },
    product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true, appliedPricingId: true, originalPackagingQty: true, pcsPerPack: true, originalPackagingUom: true } },
  };

  private async getProductPricing(productId: string, vendorId?: string | null) {
    if (vendorId) {
      const vendorPricing = await this.prisma.productPricing.findUnique({
        where: { productId_vendorId: { productId, vendorId } },
      });
      if (vendorPricing) return vendorPricing;
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (product?.appliedPricingId) {
      const appliedPricing = await this.prisma.productPricing.findUnique({
        where: { id: product.appliedPricingId },
      });
      if (appliedPricing) return appliedPricing;
    }

    return null;
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
        { requestNumber: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
        { items: { some: { description: { contains: params.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, companyName: true } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
          department: { select: { id: true, name: true } },
          items: {
            include: this.itemIncludes,
            orderBy: { itemNumber: 'asc' },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({
      where: { id },
      include: {
        tenant: { select: { id: true, companyName: true } },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        department: { select: { id: true, name: true } },
        items: {
          include: this.itemIncludes,
          orderBy: { itemNumber: 'asc' },
        },
      },
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  async create(tenantId: string, userId: string, data: any) {
    const effectiveTenantId = data.tenantId || tenantId;
    const requestNumber = await this.generateRequestNumber(effectiveTenantId);

    return this.prisma.purchaseRequest.create({
      data: {
        tenantId: effectiveTenantId,
        requestNumber,
        title: data.title,
        description: data.description || null,
        requestedById: userId,
        departmentId: data.departmentId || null,
        priority: data.priority || 'MEDIUM',
        status: 'DRAFT',
        requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
        totalAmount: 0,
        notes: data.notes || null,
      },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        items: {
          include: this.itemIncludes,
          orderBy: { itemNumber: 'asc' },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const pr = await this.prisma.purchaseRequest.findFirst({ where: { id } });
    if (!pr) throw new NotFoundException('Purchase request not found');
    if (pr.status !== 'DRAFT' && pr.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Can only edit purchase requests in DRAFT or PENDING status');
    }

    const updateData: any = {};
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.requiredDate !== undefined) updateData.requiredDate = data.requiredDate ? new Date(data.requiredDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: updateData,
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        items: {
          include: this.itemIncludes,
          orderBy: { itemNumber: 'asc' },
        },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({ where: { id, tenantId } });
    if (!pr) throw new NotFoundException('Purchase request not found');
    if (pr.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete purchase requests in DRAFT status');
    }
    await this.prisma.purchaseRequest.delete({ where: { id } });
    return { message: 'Purchase request deleted' };
  }

  // ─── Line Item CRUD ─────────────────────────────────────────

  async addItem(tenantId: string, prId: string, data: any) {
    const pr = await this.findOne(tenantId, prId);
    if (pr.status !== 'DRAFT') throw new BadRequestException('Can only add items to draft requests');

    const maxItemNumber = pr.items.reduce((max, item) => Math.max(max, item.itemNumber), 0);

    // Get product to auto-fill description and uom
    const product = data.productId ? await this.prisma.product.findUnique({ where: { id: data.productId } }) : null;

    // Resolve pricing: user-specified price > vendor pricing > applied pricing > 0
    let resolvedPrice = data.estimatedPrice;
    let resolvedVendorId = data.vendorId || null;

    if (product && resolvedPrice === undefined) {
      const pricing = await this.getProductPricing(product.id, resolvedVendorId);
      if (pricing) {
        resolvedPrice = pricing.unitCost;
        if (!resolvedVendorId) resolvedVendorId = pricing.vendorId;
      }
    }

    resolvedPrice = resolvedPrice ?? 0;

    // Calculate invQty = originalPackagingQty * pcsPerPack
    const invQty = product ? (product.originalPackagingQty || 0) * (product.pcsPerPack || 0) : (data.quantity || 1);

    const item = await this.prisma.purchaseRequestItem.create({
      data: {
        purchaseRequestId: prId,
        itemNumber: maxItemNumber + 1,
        description: product?.name || data.description || '',
        uom: product?.originalPackagingUom?.toUpperCase() || product?.unit?.toUpperCase() || data.uom || 'PCS',
        quantity: invQty,
        estimatedPrice: resolvedPrice,
        totalPrice: invQty * resolvedPrice,
        vendorId: resolvedVendorId,
        productId: data.productId || null,
        notes: data.notes || null,
      },
      include: this.itemIncludes,
    });

    await this.recalcTotal(prId);
    return item;
  }

  async updateItem(tenantId: string, prId: string, itemId: string, data: any) {
    const pr = await this.findOne(tenantId, prId);
    if (pr.status !== 'DRAFT') throw new BadRequestException('Can only edit items in draft requests');

    const existing = pr.items.find(i => i.id === itemId);
    if (!existing) throw new NotFoundException('Item not found');

    const updateData: any = {};
    if (data.productId !== undefined) {
      updateData.productId = data.productId;
      const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
      if (product) {
        updateData.description = product.name;
        updateData.uom = product.unit?.toUpperCase() || 'PCS';
      }
    }
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.vendorId !== undefined) updateData.vendorId = data.vendorId || null;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.taxable !== undefined) updateData.taxable = data.taxable;
    if (data.taxIncluded !== undefined) updateData.taxIncluded = data.taxIncluded;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    // Auto-update price when vendor changes (and user didn't manually set price)
    if (data.vendorId !== undefined && data.estimatedPrice === undefined) {
      const productId = data.productId || existing.productId;
      if (productId) {
        const pricing = await this.getProductPricing(productId, data.vendorId || null);
        if (pricing) {
          updateData.estimatedPrice = pricing.unitCost;
        }
      }
    }
    if (data.estimatedPrice !== undefined) updateData.estimatedPrice = data.estimatedPrice;

    // Recalc total: invQty (from product packaging) * unitPrice
    const productId = data.productId || existing.productId;
    let invQty = existing.quantity;
    if (productId) {
      const prod = await this.prisma.product.findUnique({ where: { id: productId } });
      if (prod) invQty = (prod.originalPackagingQty || 0) * (prod.pcsPerPack || 0);
    }
    if (data.quantity !== undefined) invQty = data.quantity;
    const price = updateData.estimatedPrice ?? data.estimatedPrice ?? existing.estimatedPrice;
    updateData.totalPrice = invQty * price;

    const item = await this.prisma.purchaseRequestItem.update({
      where: { id: itemId },
      data: updateData,
      include: this.itemIncludes,
    });

    await this.recalcTotal(prId);
    return item;
  }

  async deleteItem(tenantId: string, prId: string, itemId: string) {
    const pr = await this.findOne(tenantId, prId);
    if (pr.status !== 'DRAFT') throw new BadRequestException('Can only delete items from draft requests');

    const existing = pr.items.find(i => i.id === itemId);
    if (!existing) throw new NotFoundException('Item not found');

    await this.prisma.purchaseRequestItem.delete({ where: { id: itemId } });
    await this.recalcTotal(prId);
    return { success: true };
  }

  async applyVendorToAll(tenantId: string, prId: string, vendorId: string) {
    const pr = await this.findOne(tenantId, prId);
    if (pr.status !== 'DRAFT') throw new BadRequestException('Can only edit draft requests');

    let updatedCount = 0;

    for (const item of pr.items) {
      if (!item.productId) continue;

      // Check if this vendor has pricing for this product
      const pricing = await this.prisma.productPricing.findUnique({
        where: { productId_vendorId: { productId: item.productId, vendorId } },
      });

      if (!pricing) continue; // Skip — vendor doesn't supply this product

      const totalPrice = item.quantity * pricing.unitCost;
      await this.prisma.purchaseRequestItem.update({
        where: { id: item.id },
        data: {
          vendorId,
          estimatedPrice: pricing.unitCost,
          totalPrice,
        },
      });
      updatedCount++;
    }

    await this.recalcTotal(prId);
    return this.findOne(tenantId, prId);
  }

  private async recalcTotal(prId: string) {
    const items = await this.prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: prId },
    });
    const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    await this.prisma.purchaseRequest.update({
      where: { id: prId },
      data: { totalAmount },
    });
  }

  // ─── Status Transitions ─────────────────────────────────────

  async submit(tenantId: string, id: string) {
    const pr = await this.findOne(tenantId, id);
    if (pr.status !== 'DRAFT') {
      throw new BadRequestException('Can only submit purchase requests in DRAFT status');
    }
    if (pr.items.length === 0) {
      throw new BadRequestException('Cannot submit a request with no items');
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(tenantId: string, id: string, approvedBy: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({ where: { id, tenantId } });
    if (!pr) throw new NotFoundException('Purchase request not found');
    if (pr.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Can only approve purchase requests in PENDING_APPROVAL status');
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });
  }

  async reject(tenantId: string, id: string, rejectionNote: string, rejectedBy: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({ where: { id, tenantId } });
    if (!pr) throw new NotFoundException('Purchase request not found');
    if (pr.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Can only reject purchase requests in PENDING_APPROVAL status');
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionNote: rejectionNote || null,
      },
    });
  }
}
