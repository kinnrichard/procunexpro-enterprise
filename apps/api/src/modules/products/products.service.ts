import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeRelations = {
    manufacturer: { select: { id: true, name: true } },
    origin: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
    subCategory: { select: { id: true, name: true } },
    vendor: { select: { id: true, name: true } },
    warehouse: { select: { id: true, name: true } },
    location: { select: { id: true, name: true } },
  };

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      inventoryType?: string;
      categoryId?: string;
      manufacturerId?: string;
      createdDateFrom?: string;
      createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
        { modelNumber: { contains: params.search, mode: 'insensitive' } },
        { manufacturer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    if (params.status === 'ACTIVE') where.isActive = true;
    if (params.status === 'INACTIVE') where.isActive = false;

    if (params.inventoryType) where.inventoryType = params.inventoryType;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.manufacturerId) where.manufacturerId = params.manufacturerId;

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...this.includeRelations,
          _count: { select: { pricings: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, idOrSku: string) {
    const isId = idOrSku.length >= 20; // cuid is 25 chars
    const product = await this.prisma.product.findFirst({
      where: { tenantId, ...(isId ? { id: idOrSku } : { sku: idOrSku }) },
      include: {
        ...this.includeRelations,
        images: { orderBy: { sortOrder: 'asc' } },
        pricings: {
          include: { vendor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        components: {
          include: { material: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } },
          orderBy: { createdAt: 'asc' },
        },
        purchaseRequestItems: {
          include: {
            purchaseRequest: {
              select: { id: true, requestNumber: true, title: true, status: true, priority: true, createdAt: true, requestedBy: { select: { firstName: true, lastName: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrderItems: {
          include: {
            purchaseOrder: {
              select: { id: true, orderNumber: true, status: true, priority: true, createdAt: true, vendor: { select: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Fetch documents linked to this product
    const documents = await this.prisma.document.findMany({
      where: { tenantId, entityType: 'PRODUCT', entityId: product.id },
      orderBy: { createdAt: 'desc' },
    });

    return { ...product, documents };
  }

  async getPricingsSummary(tenantId: string, idOrSku: string) {
    const isId = idOrSku.length >= 20;
    const product = await this.prisma.product.findFirst({
      where: { tenantId, ...(isId ? { id: idOrSku } : { sku: idOrSku }) },
      select: { id: true, appliedPricingId: true, costPrice: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const pricings = await this.prisma.productPricing.findMany({
      where: { productId: product.id },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { unitCost: 'asc' },
    });

    return {
      appliedPricingId: product.appliedPricingId,
      fallbackPrice: product.costPrice,
      pricings: pricings.map((p) => ({
        id: p.id,
        vendorId: p.vendorId,
        vendorName: p.vendor.name,
        type: p.type,
        unitCost: p.unitCost,
        sellingPrice: p.sellingPrice,
        currency: p.currency,
        isApplied: p.id === product.appliedPricingId,
      })),
    };
  }

  // --- Images ---

  async addImage(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productImage.create({
      data: {
        productId,
        url: data.url,
        fileName: data.fileName || null,
        caption: data.caption || null,
        sortOrder: data.sortOrder ?? 0,
        isPrimary: data.isPrimary ?? false,
      },
    });
  }

  async updateImage(tenantId: string, productId: string, imageId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    // If setting as primary, unset all others first
    if (data.isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId, id: { not: imageId } },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.fileName !== undefined && { fileName: data.fileName }),
        ...(data.caption !== undefined && { caption: data.caption }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
    });
  }

  async deleteImage(tenantId: string, productId: string, imageId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: 'Image deleted' };
  }

  // --- Documents ---

  async addDocument(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.document.create({
      data: {
        tenantId,
        entityType: 'PRODUCT',
        entityId: productId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? null,
        uploadedBy: data.uploadedBy ?? null,
      },
    });
  }

  async deleteDocument(tenantId: string, productId: string, docId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.document.delete({ where: { id: docId } });
    return { message: 'Document deleted' };
  }

  // --- Pricing ---

  async addPricing(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.productPricing.findUnique({
      where: { productId_vendorId: { productId, vendorId: data.vendorId } },
    });
    if (existing) throw new ConflictException('Pricing for this vendor already exists. Only one price per vendor is allowed.');

    return this.prisma.productPricing.create({
      data: {
        productId,
        vendorId: data.vendorId,
        type: data.type || 'local',
        originalPackagingQty: data.originalPackagingQty ?? 1,
        pcsPerPack: data.pcsPerPack ?? 1,
        originalPackagingUom: data.originalPackagingUom || 'pcs',
        unitCost: data.unitCost ?? 0,
        sellingPrice: data.sellingPrice ?? 0,
        currency: data.currency || 'USD',
        minOrderQty: data.minOrderQty ?? 1,
        leadTimeDays: data.leadTimeDays ?? null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        notes: data.notes || null,
        isActive: data.isActive ?? true,
      },
      include: { vendor: { select: { id: true, name: true } } },
    });
  }

  async updatePricing(tenantId: string, productId: string, pricingId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    if (data.vendorId !== undefined) {
      const existing = await this.prisma.productPricing.findFirst({
        where: { productId, vendorId: data.vendorId, id: { not: pricingId } },
      });
      if (existing) throw new ConflictException('Pricing for this vendor already exists.');
    }

    const updateData: any = {};
    const fields = ['vendorId', 'type', 'originalPackagingQty', 'pcsPerPack', 'originalPackagingUom', 'unitCost', 'sellingPrice', 'currency', 'minOrderQty', 'leadTimeDays', 'notes', 'isActive'];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;

    return this.prisma.productPricing.update({
      where: { id: pricingId },
      data: updateData,
      include: { vendor: { select: { id: true, name: true } } },
    });
  }

  async applyPricing(tenantId: string, productId: string, pricingId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const pricing = await this.prisma.productPricing.findFirst({ where: { id: pricingId, productId } });
    if (!pricing) throw new NotFoundException('Pricing not found');

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        appliedPricingId: pricingId,
        costPrice: pricing.unitCost,
        sellingPrice: pricing.sellingPrice,
      },
      include: {
        ...this.includeRelations,
        images: { orderBy: { sortOrder: 'asc' } },
        pricings: {
          include: { vendor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async deletePricing(tenantId: string, productId: string, pricingId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.productPricing.delete({ where: { id: pricingId } });
    return { message: 'Pricing deleted' };
  }

  // --- Bill of Materials (composition) ---

  async getComponents(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productComponent.findMany({
      where: { tenantId, parentProductId: productId },
      include: { material: { select: { id: true, name: true, sku: true, unit: true, currentStock: true, costPrice: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Replace the full component list for a product (BOM editor saves the whole list)
  async setComponents(tenantId: string, productId: string, payload: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const rows: any[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
    const laborCostPerUnit = payload?.laborCostPerUnit ?? product.laborCostPerUnit ?? 0;
    const overheadCostPerUnit = payload?.overheadCostPerUnit ?? product.overheadCostPerUnit ?? 0;
    const formulationMode = payload?.formulationMode ?? product.formulationMode ?? 'quantity';

    // A product cannot be a component of itself
    if (rows.some((r) => r.materialId === productId)) {
      throw new ConflictException('A product cannot be a component of itself');
    }

    // Guard against duplicate materials in the submitted list
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.materialId) throw new ConflictException('Each component requires a material');
      if (seen.has(r.materialId)) throw new ConflictException('Duplicate material in composition');
      seen.add(r.materialId);
    }

    // Roll up the material cost: sum(qty x material unit cost). Becomes the product's cost price.
    const materials = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.materialId) } },
      select: { id: true, costPrice: true },
    });
    const costMap = new Map(materials.map((m) => [m.id, m.costPrice]));
    // In percentage mode, quantity is a % of one batch unit → factor = pct/100
    const factor = (q: number) => (formulationMode === 'percentage' ? (q ?? 0) / 100 : (q ?? 1));
    const materialCost = rows.reduce((sum, r) => sum + factor(r.quantity) * (costMap.get(r.materialId) ?? 0), 0);
    // Full unit cost = materials + labor + overhead
    const rolledUpCost = materialCost + laborCostPerUnit + overheadCostPerUnit;

    const ops: any[] = [
      this.prisma.productComponent.deleteMany({ where: { tenantId, parentProductId: productId } }),
      ...rows.map((r) =>
        this.prisma.productComponent.create({
          data: {
            tenantId,
            parentProductId: productId,
            materialId: r.materialId,
            quantity: r.quantity ?? 1,
            uom: r.uom || 'pcs',
            notes: r.notes || null,
          },
        }),
      ),
    ];

    // Persist labor/overhead/mode always; overwrite cost only when a composition is defined
    const productData: any = { laborCostPerUnit, overheadCostPerUnit, formulationMode };
    if (rows.length > 0) productData.costPrice = rolledUpCost;
    ops.push(this.prisma.product.update({ where: { id: productId }, data: productData }));

    await this.prisma.$transaction(ops);

    return this.getComponents(tenantId, productId);
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.product.findFirst({
      where: { tenantId, sku: data.sku },
    });
    if (existing) throw new ConflictException('Product SKU already exists');

    // Generate unique slug
    let slug = generateSlug(data.name);
    const slugExists = await this.prisma.product.findFirst({ where: { tenantId, slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    return this.prisma.product.create({
      data: {
        tenantId,
        inventoryType: data.inventoryType || 'product',
        name: data.name,
        slug,
        manufacturerId: data.manufacturerId,
        modelNumber: data.modelNumber,
        sku: data.sku,
        barcode: data.barcode || null,
        description: data.description || null,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId || null,
        vendorId: data.vendorId || null,
        originId: data.originId,

        // Specs
        length: data.length ?? null,
        depth: data.depth ?? null,
        height: data.height ?? null,
        weight: data.weight ?? null,

        // Stock levels
        minStock: data.minStock ?? 1,
        maxStock: data.maxStock ?? 1,
        reorderQuantity: data.reorderQuantity ?? 1,
        shelfLifeDays: data.shelfLifeDays ?? null,
        qcRequired: data.qcRequired ?? false,

        // Legacy defaults
        unit: data.unit || 'pcs',
        costPrice: data.costPrice || 0,
        sellingPrice: data.sellingPrice || 0,
        currentStock: data.currentStock || 0,
        reorderPoint: data.reorderPoint || 0,
        warehouseId: data.warehouseId || null,
        locationId: data.locationId || null,
        isActive: data.isActive === undefined ? true : data.isActive,
      },
      include: this.includeRelations,
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    if (data.sku && data.sku !== product.sku) {
      const duplicate = await this.prisma.product.findFirst({
        where: { tenantId, sku: data.sku, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Product SKU already exists');
    }

    if (data.name && data.name !== product.name) {
      let slug = generateSlug(data.name);
      const slugExists = await this.prisma.product.findFirst({ where: { tenantId, slug, id: { not: id } } });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }

    const updateData: any = {};
    const fields = [
      'inventoryType', 'name', 'slug', 'manufacturerId', 'modelNumber', 'sku', 'barcode',
      'description', 'categoryId', 'subCategoryId', 'vendorId', 'originId',
      'length', 'depth', 'height', 'weight',
      'minStock', 'maxStock', 'reorderQuantity', 'shelfLifeDays', 'qcRequired',
      'unit', 'costPrice', 'laborCostPerUnit', 'overheadCostPerUnit', 'formulationMode', 'sellingPrice', 'currentStock', 'reorderPoint',
      'warehouseId', 'locationId', 'isActive',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: this.includeRelations,
    });
  }

  async delete(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Product deleted' };
  }

  async getLowStock(tenantId: string) {
    const filtered = await this.prisma.$queryRaw`
      SELECT p.id, p.name, p.sku, p."currentStock", p."reorderPoint", p."costPrice", p.unit
      FROM "Product" p
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND p."currentStock" <= p."reorderPoint"
        AND p."reorderPoint" > 0
      ORDER BY (p."currentStock"::float / NULLIF(p."reorderPoint", 0)) ASC
      LIMIT 100
    `;

    return filtered;
  }
}
