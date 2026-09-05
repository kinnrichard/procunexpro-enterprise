import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { RolesService } from '../roles/roles.service';
import { InventoryTypesService } from '../inventory-types/inventory-types.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

// Baseline PH config seeded into every new org so it's usable immediately.
const BASE_CURRENCIES = [
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', isDefault: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: false },
];
const BASE_TAXES = [
  { name: 'VAT', rate: 12, isDefault: true },
  { name: 'Zero-rated', rate: 0, isDefault: false },
  { name: 'Exempt', rate: 0, isDefault: false },
];
const BASE_TERMS = [
  { name: 'Net 30', description: 'Payment due within 30 days', isDefault: true },
  { name: 'Net 60', description: 'Payment due within 60 days', isDefault: false },
  { name: 'COD', description: 'Cash on delivery', isDefault: false },
  { name: 'Prepaid', description: 'Full payment before shipment', isDefault: false },
];
const BASE_UOMS = [
  { code: 'pcs', name: 'Piece', category: 'count', baseFactor: 1 },
  { code: 'box', name: 'Box', category: 'count', baseFactor: 1 },
  { code: 'pack', name: 'Pack', category: 'count', baseFactor: 1 },
  { code: 'dozen', name: 'Dozen', category: 'count', baseFactor: 12 },
  { code: 'kg', name: 'Kilogram', category: 'weight', baseFactor: 1000 },
  { code: 'g', name: 'Gram', category: 'weight', baseFactor: 1 },
  { code: 'mg', name: 'Milligram', category: 'weight', baseFactor: 0.001 },
  { code: 'L', name: 'Liter', category: 'volume', baseFactor: 1000 },
  { code: 'ml', name: 'Milliliter', category: 'volume', baseFactor: 1 },
  { code: 'm', name: 'Meter', category: 'length', baseFactor: 100 },
  { code: 'cm', name: 'Centimeter', category: 'length', baseFactor: 1 },
];

function generatePassword(): string {
  return crypto.randomBytes(9).toString('base64').replaceAll(/[/+=]/g, '') + 'Aa#9';
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly inventoryTypesService: InventoryTypesService,
  ) {}

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { schemaName: { contains: params.search, mode: 'insensitive' } },
        { domain: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, products: true, departments: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, products: true, departments: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Company not found');
    return tenant;
  }

  // Onboard a new organization: tenant + ADMIN user (password supplied by the caller,
  // stored only as a hash) + optional per-org `developer` SUPERADMIN (generated password
  // returned ONCE) + PH baseline config — all atomically. System roles and inventory
  // types are ensured afterward (idempotent).
  async create(data: CreateTenantDto) {
    const companyName = data.companyName?.trim();
    if (!companyName) throw new BadRequestException('Company name is required');

    const adminUsername = data.adminUsername?.trim();
    if (adminUsername?.toLowerCase() === 'developer') {
      throw new BadRequestException('"developer" is a reserved username');
    }

    const existing = await this.prisma.tenant.findFirst({ where: { companyName } });
    if (existing) throw new ConflictException('Company name already exists');

    const schemaName = companyName.toLowerCase().replaceAll(/[^a-z0-9]/g, '_');

    const adminHash = await bcrypt.hash(data.adminPassword, 10);
    const createDeveloper = data.createDeveloper !== false;
    const developerPassword = createDeveloper ? generatePassword() : null;
    const developerHash = developerPassword ? await bcrypt.hash(developerPassword, 10) : null;

    const settings = data.settings ?? {
      currency: 'PHP',
      dateFormat: 'MM/DD/YYYY',
      timezone: 'Asia/Manila',
    };

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: { companyName, schemaName, status: 'ACTIVE', settings },
      });

      await tx.user.create({
        data: {
          tenantId: t.id, username: adminUsername, email: data.adminEmail,
          passwordHash: adminHash, firstName: 'System', lastName: 'Admin',
          role: 'ADMIN', mustChangePassword: true,
        },
      });

      if (developerHash) {
        await tx.user.create({
          data: {
            tenantId: t.id, username: 'developer', email: 'developer@kinnitech.local',
            passwordHash: developerHash, firstName: 'Kinnitech', lastName: 'Developer',
            role: 'SUPERADMIN', mustChangePassword: false,
          },
        });
      }

      await tx.currency.createMany({ data: BASE_CURRENCIES.map((c) => ({ tenantId: t.id, ...c })) });
      await tx.tax.createMany({ data: BASE_TAXES.map((x) => ({ tenantId: t.id, ...x })) });
      await tx.purchaseTerm.createMany({ data: BASE_TERMS.map((x) => ({ tenantId: t.id, ...x })) });
      await tx.unitOfMeasure.createMany({ data: BASE_UOMS.map((u) => ({ tenantId: t.id, ...u })) });

      return t;
    });

    // Idempotent, non-critical — safe to run outside the transaction.
    await this.rolesService.ensureSystemRoles(tenant.id);
    await this.inventoryTypesService.ensureSystemTypes(tenant.id);

    const full = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { _count: { select: { users: true, products: true, departments: true } } },
    });

    // developerPassword is surfaced ONLY here (never stored in plaintext).
    return { ...full, developerPassword };
  }

  async update(id: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company not found');

    if (data.companyName && data.companyName !== tenant.companyName) {
      const duplicate = await this.prisma.tenant.findFirst({
        where: { companyName: data.companyName, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Company name already exists');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.domain !== undefined && { domain: data.domain || null }),
        ...(data.logo !== undefined && { logo: data.logo || null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.settings !== undefined && { settings: data.settings }),
      },
      include: {
        _count: { select: { users: true, products: true, departments: true } },
      },
    });
  }

  async delete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Company not found');
    await this.prisma.tenant.delete({ where: { id } });
    return { message: 'Company deleted' };
  }
}
