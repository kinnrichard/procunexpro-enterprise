import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CoaHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Classifications ──────────────────────────────────
  async getClassifications(tenantId: string, accountType?: string) {
    const where: any = { tenantId };
    if (accountType) where.accountType = accountType;
    return this.prisma.coaClassification.findMany({ where, orderBy: { name: 'asc' } });
  }

  async createClassification(tenantId: string, data: { accountType: string; name: string }) {
    const existing = await this.prisma.coaClassification.findFirst({ where: { tenantId, accountType: data.accountType, name: data.name } });
    if (existing) throw new ConflictException('Classification already exists');
    return this.prisma.coaClassification.create({ data: { tenantId, accountType: data.accountType, name: data.name } });
  }

  async updateClassification(tenantId: string, id: string, data: any) {
    const item = await this.prisma.coaClassification.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Classification not found');
    if (data.name && data.name !== item.name) {
      const dup = await this.prisma.coaClassification.findFirst({ where: { tenantId, accountType: data.accountType || item.accountType, name: data.name, id: { not: id } } });
      if (dup) throw new ConflictException('Classification already exists');
    }
    return this.prisma.coaClassification.update({ where: { id }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.accountType !== undefined && { accountType: data.accountType }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async deleteClassification(tenantId: string, id: string) {
    const item = await this.prisma.coaClassification.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Classification not found');
    await this.prisma.coaClassification.delete({ where: { id } });
    return { message: 'Classification deleted' };
  }

  // ─── Categories ───────────────────────────────────────
  async getCategories(tenantId: string, classificationId?: string) {
    const where: any = { tenantId };
    if (classificationId) where.classificationId = classificationId;
    return this.prisma.coaCategory.findMany({ where, orderBy: { name: 'asc' }, include: { classification: { select: { id: true, name: true, accountType: true } } } });
  }

  async createCategory(tenantId: string, data: { classificationId: string; name: string }) {
    const existing = await this.prisma.coaCategory.findFirst({ where: { tenantId, classificationId: data.classificationId, name: data.name } });
    if (existing) throw new ConflictException('Category already exists');
    return this.prisma.coaCategory.create({ data: { tenantId, classificationId: data.classificationId, name: data.name }, include: { classification: { select: { id: true, name: true, accountType: true } } } });
  }

  async updateCategory(tenantId: string, id: string, data: any) {
    const item = await this.prisma.coaCategory.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Category not found');
    return this.prisma.coaCategory.update({ where: { id }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.classificationId !== undefined && { classificationId: data.classificationId }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async deleteCategory(tenantId: string, id: string) {
    const item = await this.prisma.coaCategory.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Category not found');
    await this.prisma.coaCategory.delete({ where: { id } });
    return { message: 'Category deleted' };
  }

  // ─── Sub Categories ───────────────────────────────────
  async getSubCategories(tenantId: string, categoryId?: string) {
    const where: any = { tenantId };
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.coaSubCategory.findMany({ where, orderBy: { name: 'asc' }, include: { category: { select: { id: true, name: true, classification: { select: { id: true, name: true, accountType: true } } } } } });
  }

  async createSubCategory(tenantId: string, data: { categoryId: string; name: string }) {
    const existing = await this.prisma.coaSubCategory.findFirst({ where: { tenantId, categoryId: data.categoryId, name: data.name } });
    if (existing) throw new ConflictException('Sub Category already exists');
    return this.prisma.coaSubCategory.create({ data: { tenantId, categoryId: data.categoryId, name: data.name }, include: { category: { select: { id: true, name: true } } } });
  }

  async updateSubCategory(tenantId: string, id: string, data: any) {
    const item = await this.prisma.coaSubCategory.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Sub Category not found');
    return this.prisma.coaSubCategory.update({ where: { id }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.categoryId !== undefined && { categoryId: data.categoryId }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async deleteSubCategory(tenantId: string, id: string) {
    const item = await this.prisma.coaSubCategory.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Sub Category not found');
    await this.prisma.coaSubCategory.delete({ where: { id } });
    return { message: 'Sub Category deleted' };
  }
}
