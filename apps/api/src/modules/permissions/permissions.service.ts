import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FULL_ACCESS_ROLES, MODULES, PermAction } from './permissions.constants';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  // Seed a least-privilege default row for the given roles x modules (idempotent).
  private async ensureSeeded(tenantId: string, roleKeys: string[]) {
    const rows: any[] = [];
    for (const role of roleKeys) {
      for (const m of MODULES) {
        rows.push({ tenantId, role, module: m.key, canView: true, canCreate: false, canEdit: false, canDelete: false });
      }
    }
    if (rows.length) {
      await this.prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }

  async getMatrix(tenantId: string) {
    const roleKeys = await this.roles.configurableKeys(tenantId);
    await this.ensureSeeded(tenantId, roleKeys);
    const rows = await this.prisma.rolePermission.findMany({ where: { tenantId } });
    return { roles: roleKeys, modules: MODULES, permissions: rows };
  }

  async updateMatrix(tenantId: string, items: any[]) {
    const roleKeys = new Set(await this.roles.configurableKeys(tenantId));
    const rows = Array.isArray(items) ? items : [];
    await this.prisma.$transaction(
      rows
        .filter((r) => roleKeys.has(r.role) && MODULES.some((m) => m.key === r.module))
        .map((r) =>
          this.prisma.rolePermission.upsert({
            where: { tenantId_role_module: { tenantId, role: r.role, module: r.module } },
            create: { tenantId, role: r.role, module: r.module, canView: !!r.canView, canCreate: !!r.canCreate, canEdit: !!r.canEdit, canDelete: !!r.canDelete },
            update: { canView: !!r.canView, canCreate: !!r.canCreate, canEdit: !!r.canEdit, canDelete: !!r.canDelete },
          }),
        ),
    );
    return this.getMatrix(tenantId);
  }

  // The effective permissions for a given role, as { module: {view,create,edit,delete} }
  async getEffective(tenantId: string, role: string) {
    if (FULL_ACCESS_ROLES.includes(role)) {
      const all: Record<string, any> = {};
      for (const m of MODULES) all[m.key] = { view: true, create: true, edit: true, delete: true };
      return { role, admin: true, modules: all };
    }
    await this.ensureSeeded(tenantId, [role]);
    const rows = await this.prisma.rolePermission.findMany({ where: { tenantId, role } });
    const map: Record<string, any> = {};
    for (const m of MODULES) map[m.key] = { view: true, create: false, edit: false, delete: false };
    for (const r of rows) map[r.module] = { view: r.canView, create: r.canCreate, edit: r.canEdit, delete: r.canDelete };
    return { role, admin: false, modules: map };
  }

  // Single-permission check used by the guard
  async can(tenantId: string, role: string, module: string, action: PermAction): Promise<boolean> {
    if (FULL_ACCESS_ROLES.includes(role)) return true;
    const row = await this.prisma.rolePermission.findUnique({ where: { tenantId_role_module: { tenantId, role, module } } });
    if (!row) return action === 'view'; // no config yet → view allowed, mutations denied
    const key = ({ view: 'canView', create: 'canCreate', edit: 'canEdit', delete: 'canDelete' } as const)[action];
    return !!(row as any)[key];
  }
}
