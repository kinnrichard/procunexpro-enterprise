import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UnitsOfMeasureService, convertQuantity } from '../units-of-measure/units-of-measure.service';
import { StockLotsService, LotAllocation } from '../stock-lots/stock-lots.service';

// Round only for display/comparison noise, keeping fractional precision
const roundQty = (n: number) => Math.round(n * 1e6) / 1e6;
const DAY_MS = 86_400_000;

@Injectable()
export class ProductionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uom: UnitsOfMeasureService,
    private readonly lots: StockLotsService,
  ) {}

  private readonly itemInclude = {
    items: {
      include: { material: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
    product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } },
    warehouse: { select: { id: true, name: true } },
    laborRate: { select: { id: true, name: true, ratePerHour: true } },
  };

  private async generateReferenceNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `PRD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.production.count({
      where: { tenantId, referenceNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  // Pre-compute N unique stock-movement reference numbers (counts don't see uncommitted rows in a txn)
  private async generateMovementRefs(tenantId: string, n: number): Promise<string[]> {
    const today = new Date();
    const prefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const base = await this.prisma.stockMovement.count({
      where: { tenantId, referenceNumber: { startsWith: prefix } },
    });
    return Array.from({ length: n }, (_, i) => `${prefix}-${String(base + i + 1).padStart(4, '0')}`);
  }

  // labor cost = selected rate/hour x hours; falls back to an explicit laborCost
  private async computeLaborCost(tenantId: string, laborRateId?: string, laborHours?: number, explicit?: number): Promise<number> {
    if (laborRateId) {
      const rate = await this.prisma.laborRate.findFirst({ where: { id: laborRateId, tenantId } });
      return roundQty((rate?.ratePerHour ?? 0) * (laborHours ?? 0));
    }
    return explicit ?? 0;
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string; productId?: string; dateFrom?: string; dateTo?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.status) where.status = params.status;
    if (params.productId) where.productId = params.productId;
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.createdAt.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
    }
    if (params.search) {
      where.OR = [
        { referenceNumber: { contains: params.search, mode: 'insensitive' } },
        { product: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.production.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.production.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const production = await this.prisma.production.findFirst({
      where: { id, tenantId },
      include: this.itemInclude,
    });
    if (!production) throw new NotFoundException('Production not found');
    return production;
  }

  // Preview the materials a run of `quantity` units would consume, from the product's BOM
  async previewFromBom(tenantId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const components = await this.prisma.productComponent.findMany({
      where: { tenantId, parentProductId: productId },
      include: { material: { select: { id: true, name: true, sku: true, unit: true, currentStock: true, costPrice: true } } },
    });

    const uomMap = await this.uom.getMap(tenantId);
    const qty = quantity > 0 ? quantity : 1;
    // In percentage mode, component qty is a % of the batch size (= production quantity)
    const perBatchUnit = (q: number) => (product.formulationMode === 'percentage' ? (q / 100) * qty : q * qty);
    return components.map((c) => {
      const required = perBatchUnit(c.quantity); // in the recipe's uom
      // Convert to the material's stock unit for the availability check
      const requiredInStock = roundQty(convertQuantity(required, c.uom, c.material.unit, uomMap));
      return {
        materialId: c.materialId,
        material: c.material,
        perUnit: c.quantity,
        uom: c.uom,
        quantity: roundQty(required),
        requiredInStock,
        stockUnit: c.material.unit,
        available: c.material.currentStock,
        sufficient: c.material.currentStock >= requiredInStock,
        lineCost: roundQty(requiredInStock * (c.material.costPrice ?? 0)),
      };
    });
  }

  // How many units of each BOM product can be built from current material stock
  async forecast(tenantId: string) {
    const parents = await this.prisma.product.findMany({
      where: { tenantId, isActive: true, components: { some: {} } },
      include: {
        components: { include: { material: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    const uomMap = await this.uom.getMap(tenantId);

    const data = parents.map((p) => {
      let maxBuildable = Infinity;
      let limitingMaterial: string | null = null;
      const components = p.components.map((c) => {
        const perUnit = p.formulationMode === 'percentage' ? c.quantity / 100 : c.quantity;
        const requiredInStock = roundQty(convertQuantity(perUnit, c.uom, c.material.unit, uomMap));
        const canMake = requiredInStock > 0 ? Math.floor(c.material.currentStock / requiredInStock) : Infinity;
        if (canMake < maxBuildable) { maxBuildable = canMake; limitingMaterial = c.material.name; }
        return { material: c.material.name, sku: c.material.sku, requiredPerUnit: requiredInStock, unit: c.material.unit, available: c.material.currentStock, canMake: Number.isFinite(canMake) ? canMake : null };
      });
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        formulationMode: p.formulationMode,
        maxBuildable: Number.isFinite(maxBuildable) ? maxBuildable : 0,
        limitingMaterial,
        components,
      };
    });

    return { data };
  }

  async create(tenantId: string, userId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: data.productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const quantity = data.quantity ?? 1;
    if (quantity <= 0) throw new BadRequestException('Quantity must be greater than zero');

    // Use provided items, else auto-fill from the product's BOM x quantity
    let items: Array<{ materialId: string; quantity: number; uom: string }>;
    if (Array.isArray(data.items) && data.items.length > 0) {
      items = data.items.map((i: any) => ({
        materialId: i.materialId,
        quantity: i.quantity ?? 0,
        uom: i.uom || 'pcs',
      }));
    } else {
      const components = await this.prisma.productComponent.findMany({
        where: { tenantId, parentProductId: data.productId },
      });
      const scale = (q: number) => (product.formulationMode === 'percentage' ? (q / 100) * quantity : q * quantity);
      items = components.map((c) => ({
        materialId: c.materialId,
        quantity: scale(c.quantity),
        uom: c.uom,
      }));
    }

    const referenceNumber = await this.generateReferenceNumber(tenantId);
    const laborCost = await this.computeLaborCost(tenantId, data.laborRateId, data.laborHours, data.laborCost);

    const production = await this.prisma.production.create({
      data: {
        tenantId,
        referenceNumber,
        productId: data.productId,
        quantity,
        laborRateId: data.laborRateId || null,
        laborHours: data.laborHours ?? 0,
        laborCost,
        overheadCost: data.overheadCost ?? 0,
        warehouseId: data.warehouseId || null,
        locationId: data.locationId || null,
        status: 'DRAFT',
        notes: data.notes || null,
        createdBy: userId,
        items: { create: items },
      },
      include: this.itemInclude,
    });

    return production;
  }

  async update(tenantId: string, id: string, data: any) {
    const production = await this.prisma.production.findFirst({ where: { id, tenantId } });
    if (!production) throw new NotFoundException('Production not found');
    if (production.status !== 'DRAFT') {
      throw new BadRequestException('Only draft productions can be edited');
    }

    const updateData: any = {};
    if (data.quantity !== undefined) {
      if (data.quantity <= 0) throw new BadRequestException('Quantity must be greater than zero');
      updateData.quantity = data.quantity;
    }
    if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.overheadCost !== undefined) updateData.overheadCost = data.overheadCost;
    if (data.laborRateId !== undefined || data.laborHours !== undefined) {
      const laborRateId = data.laborRateId !== undefined ? data.laborRateId : production.laborRateId;
      const laborHours = data.laborHours !== undefined ? data.laborHours : production.laborHours;
      updateData.laborRateId = laborRateId || null;
      updateData.laborHours = laborHours ?? 0;
      updateData.laborCost = await this.computeLaborCost(tenantId, laborRateId, laborHours, data.laborCost);
    } else if (data.laborCost !== undefined) {
      updateData.laborCost = data.laborCost;
    }

    // Replace items if supplied
    const ops: any[] = [
      this.prisma.production.update({ where: { id }, data: updateData }),
    ];
    if (Array.isArray(data.items)) {
      ops.push(
        this.prisma.productionItem.deleteMany({ where: { productionId: id } }),
        ...data.items.map((i: any) =>
          this.prisma.productionItem.create({
            data: {
              productionId: id,
              materialId: i.materialId,
              quantity: i.quantity ?? 0,
              uom: i.uom || 'pcs',
            },
          }),
        ),
      );
    }
    await this.prisma.$transaction(ops);

    return this.findOne(tenantId, id);
  }

  // Consume materials + produce finished goods, all atomically
  async complete(tenantId: string, id: string, userId: string) {
    const production = await this.prisma.production.findFirst({
      where: { id, tenantId },
      include: { items: { include: { material: true } }, product: { select: { shelfLifeDays: true, qcRequired: true } } },
    });
    if (!production) throw new NotFoundException('Production not found');
    if (production.status === 'COMPLETED') throw new BadRequestException('Production is already completed');
    if (production.status === 'CANCELLED') throw new BadRequestException('Cannot complete a cancelled production');
    if (production.items.length === 0) throw new BadRequestException('Production has no materials to consume');

    const uomMap = await this.uom.getMap(tenantId);
    // Amount to draw from each material's stock, in that material's own unit
    const needByItem = new Map<string, number>();
    for (const item of production.items) {
      const need = roundQty(convertQuantity(item.quantity, item.uom, item.material.unit, uomMap));
      needByItem.set(item.id, need);
      if (item.material.currentStock < need) {
        throw new BadRequestException(
          `Insufficient stock for ${item.material.name}. Available: ${item.material.currentStock} ${item.material.unit}, required: ${need} ${item.material.unit}`,
        );
      }
    }

    const producedQty = roundQty(production.quantity);
    const producedAt = new Date();
    // One movement per consumed material + one for the produced finished good
    const refs = await this.generateMovementRefs(tenantId, production.items.length + 1);

    // FEFO lot allocation per material (best-effort; any remainder is unlotted stock)
    const allocByItem = new Map<string, LotAllocation[]>();
    for (const item of production.items) {
      allocByItem.set(item.id, await this.lots.allocateFEFO(tenantId, item.materialId, needByItem.get(item.id) ?? 0));
    }

    const ops: any[] = [];

    production.items.forEach((item, idx) => {
      const need = needByItem.get(item.id) ?? 0;
      ops.push(
        this.prisma.stockMovement.create({
          data: {
            tenantId,
            referenceNumber: refs[idx],
            productId: item.materialId,
            type: 'PRODUCTION_ISSUE',
            quantity: need,
            fromWarehouseId: production.warehouseId || null,
            productionId: production.id,
            reason: `Consumed by production ${production.referenceNumber}`,
            performedBy: userId,
          },
        }),
        this.prisma.product.update({
          where: { id: item.materialId },
          data: { currentStock: { decrement: need } },
        }),
      );
      // Draw down the allocated lots and record traceability
      for (const a of allocByItem.get(item.id) ?? []) {
        ops.push(
          this.prisma.stockLot.update({
            where: { id: a.lotId },
            data: { quantity: a.remainingAfter, ...(a.remainingAfter <= 0 ? { status: 'DEPLETED' } : {}) },
          }),
          this.prisma.lotConsumption.create({
            data: { tenantId, lotId: a.lotId, productionId: production.id, quantity: a.take },
          }),
        );
      }
    });

    // Create a lot for the produced finished good (with expiry from shelf life, if set)
    const shelf = production.product?.shelfLifeDays ?? null;
    const finishedExpiry = shelf ? new Date(producedAt.getTime() + shelf * DAY_MS) : null;
    ops.push(
      this.prisma.stockLot.create({
        data: {
          tenantId,
          productId: production.productId,
          lotNumber: production.referenceNumber,
          quantity: producedQty,
          initialQty: producedQty,
          warehouseId: production.warehouseId || null,
          locationId: production.locationId || null,
          expiryDate: finishedExpiry,
          source: `Production ${production.referenceNumber}`,
          status: 'AVAILABLE',
          qcStatus: production.product?.qcRequired ? 'PENDING' : 'PASSED',
          productionId: production.id,
        },
      }),
    );

    // Produce the finished good
    ops.push(
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          referenceNumber: refs[production.items.length],
          productId: production.productId,
          type: 'PRODUCTION_IN',
          quantity: producedQty,
          toWarehouseId: production.warehouseId || null,
          toLocationId: production.locationId || null,
          productionId: production.id,
          reason: `Produced by production ${production.referenceNumber}`,
          performedBy: userId,
        },
      }),
      this.prisma.product.update({
        where: { id: production.productId },
        data: { currentStock: { increment: producedQty } },
      }),
      this.prisma.production.update({
        where: { id: production.id },
        data: { status: 'COMPLETED', producedAt },
      }),
    );

    await this.prisma.$transaction(ops);

    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string) {
    const production = await this.prisma.production.findFirst({ where: { id, tenantId } });
    if (!production) throw new NotFoundException('Production not found');
    if (production.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed production');
    }
    await this.prisma.production.update({ where: { id }, data: { status: 'CANCELLED' } });
    return this.findOne(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const production = await this.prisma.production.findFirst({ where: { id, tenantId } });
    if (!production) throw new NotFoundException('Production not found');
    if (production.status === 'COMPLETED') {
      throw new BadRequestException('Cannot delete a completed production');
    }
    await this.prisma.production.delete({ where: { id } });
    return { message: 'Production deleted' };
  }
}
