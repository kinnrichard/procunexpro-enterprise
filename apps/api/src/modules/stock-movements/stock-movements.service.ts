import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateReferenceNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.stockMovement.count({
      where: {
        tenantId,
        referenceNumber: { startsWith: prefix },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; type?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.type) where.type = params.type;

    if (params.search) {
      where.OR = [
        { referenceNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, orderNumber: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, tenantId },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, orderNumber: true } },
      },
    });
    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }

  async create(tenantId: string, userId: string, data: any) {
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const referenceNumber = await this.generateReferenceNumber(tenantId);

    // Update product stock based on movement type
    const addTypes = ['PURCHASE', 'TRANSFER_IN', 'RETURN'];
    const subtractTypes = ['SALE', 'TRANSFER_OUT', 'WRITE_OFF'];

    let stockUpdate: any;

    if (addTypes.includes(data.type)) {
      stockUpdate = { currentStock: { increment: data.quantity } };
    } else if (subtractTypes.includes(data.type)) {
      if (product.currentStock < data.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Current: ${product.currentStock}, Requested: ${data.quantity}`,
        );
      }
      stockUpdate = { currentStock: { decrement: data.quantity } };
    } else if (data.type === 'ADJUSTMENT') {
      stockUpdate = { currentStock: data.quantity };
    }

    // Use transaction to ensure atomicity
    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          referenceNumber,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          fromWarehouseId: data.fromWarehouseId || null,
          toWarehouseId: data.toWarehouseId || null,
          purchaseOrderId: data.purchaseOrderId || null,
          reason: data.reason || null,
          notes: data.notes || null,
          performedBy: userId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.product.update({
        where: { id: data.productId },
        data: stockUpdate,
      }),
    ]);

    return movement;
  }
}
