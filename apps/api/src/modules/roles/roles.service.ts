import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FULL_ACCESS_ROLES, MODULES } from '../permissions/permissions.constants';
import { SYSTEM_ROLES } from './roles.constants';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotently make sure the built-in roles exist for this tenant.
  async ensureSystemRoles(tenantId: string) {
    for (const r of SYSTEM_ROLES) {
      await this.prisma.role.upsert({
        where: { tenantId_key: { tenantId, key: r.key } },
        create: { tenantId, key: r.key, label: r.label, description: r.description, isSystem: true },
        update: { isSystem: true },
      });
    }
  }

  async list(tenantId: string) {
    await this.ensureSystemRoles(tenantId);
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { label: 'asc' }],
    });
    const counts = await this.prisma.user.groupBy({
      by: ['role'],
      where: { tenantId },
      _count: { _all: true },
    });
    const countByKey = new Map(counts.map((c) => [c.role, c._count._all]));
    return roles.map((r) => ({ ...r, userCount: countByKey.get(r.key) ?? 0 }));
  }

  // Role keys that appear in the editable permission matrix (everything except full-access).
  async configurableKeys(tenantId: string): Promise<string[]> {
    await this.ensureSystemRoles(tenantId);
    const roles = await this.prisma.role.findMany({
      where: { tenantId, key: { notIn: FULL_ACCESS_ROLES } },
      orderBy: [{ isSystem: 'desc' }, { label: 'asc' }],
    });
    return roles.map((r) => r.key);
  }

  private toKey(input: string): string {
    return input
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]+/g, '_')
      .replaceAll(/^_+|_+$/g, '');
  }

  async create(tenantId: string, data: { label?: string; description?: string; key?: string }) {
    const label = (data.label || '').trim();
    if (!label) throw new BadRequestException('Role name is required');
    const key = this.toKey(data.key?.trim() || label);
    if (!key) throw new BadRequestException('Invalid role name');
    if (FULL_ACCESS_ROLES.includes(key)) throw new BadRequestException('That name is reserved');
    const existing = await this.prisma.role.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (existing) throw new BadRequestException('A role with a similar name already exists');

    const role = await this.prisma.role.create({
      data: { tenantId, key, label, description: data.description?.trim() || null, isSystem: false },
    });
    // Least-privilege defaults: view-only on every module.
    await this.prisma.rolePermission.createMany({
      data: MODULES.map((m) => ({ tenantId, role: key, module: m.key, canView: true, canCreate: false, canEdit: false, canDelete: false })),
      skipDuplicates: true,
    });
    return role;
  }

  async update(tenantId: string, id: string, data: { label?: string; description?: string }) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label.trim() || role.label }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('Built-in roles cannot be deleted');
    const inUse = await this.prisma.user.count({ where: { tenantId, role: role.key } });
    if (inUse > 0) throw new BadRequestException(`${inUse} user(s) still have this role — reassign them first`);
    await this.prisma.rolePermission.deleteMany({ where: { tenantId, role: role.key } });
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }
}
