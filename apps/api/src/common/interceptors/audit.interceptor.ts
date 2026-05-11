import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@prisma/client';

const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

const SKIP_ROUTES = ['/api/auth', '/api/health', '/health', '/api/comments', '/api/audit'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private resolveFkName(key: string, record: any, fallback: any): any {
    const fkMap: Record<string, string> = { companyId: 'company', departmentId: 'department', vendorId: 'vendor' };
    const rel = fkMap[key];
    return rel && record?.[rel]?.name ? record[rel].name : fallback;
  }

  private buildDiff(oldRecord: any, bodyValues: any, responseData: any): { oldValues: any; newValues: any } | null {
    const changedOld: any = {};
    const changedNew: any = {};
    let hasChanges = false;

    for (const key of Object.keys(bodyValues)) {
      if (key.startsWith('__') || oldRecord[key] === undefined) continue;

      const oldRaw = oldRecord[key];
      const oldStr = oldRaw instanceof Date ? oldRaw.toISOString() : String(oldRaw ?? '');
      const newStr = String(bodyValues[key] ?? '');

      if (oldStr !== newStr) {
        hasChanges = true;
        changedOld[key] = this.resolveFkName(key, oldRecord, oldRaw);
        changedNew[key] = this.resolveFkName(key, responseData, bodyValues[key]);
      }
    }

    return hasChanges ? { oldValues: changedOld, newValues: changedNew } : null;
  }

  private async fetchOldRecord(url: string, params: any): Promise<any> {
    try {
      // Item update: /api/purchase-requests/:id/items/:itemId
      if (url.includes('/items/') && params?.itemId) {
        return this.prisma.purchaseRequestItem.findUnique({
          where: { id: params.itemId },
          include: { product: { select: { name: true } }, vendor: { select: { name: true } } },
        });
      }
      // PR update: /api/purchase-requests/:id
      if (/\/purchase-requests\/[^/]+$/.exec(url) && params?.id) {
        return this.prisma.purchaseRequest.findUnique({
          where: { id: params.id },
          include: {
            company: { select: { name: true } },
            department: { select: { name: true } },
          },
        });
      }
    } catch {}
    return null;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit POST, PUT, PATCH, DELETE
    if (!METHOD_ACTION_MAP[method]) {
      return next.handle();
    }

    // Skip auth and health routes
    const url: string = request.url || request.path || '';
    if (SKIP_ROUTES.some((route) => url.startsWith(route))) {
      return next.handle();
    }

    let action = METHOD_ACTION_MAP[method];
    const user = request.user;

    // Extract entityType from route path (e.g., '/api/vendors/123' -> 'VENDOR')
    const pathSegments = url.replace(/^\/api\//, '').split('/');
    const rawEntity = pathSegments[0] || 'unknown';
    // Normalize: 'purchase-requests' -> 'PURCHASE_REQUEST', 'vendors' -> 'VENDOR'
    const entityType = rawEntity.replaceAll('-', '_').replace(/s$/, '').toUpperCase();

    // Extract entityId from route params
    const entityId = request.params?.id || null;

    // Detect status change actions (submit, approve, reject, cancel)
    const statusActions = ['submit', 'approve', 'reject', 'cancel'];
    const lastSegment = pathSegments.at(-1) ?? '';
    if (statusActions.includes(lastSegment)) {
      action = 'STATUS_CHANGE';
    }

    // Capture request body for POST/PUT, include URL for context
    const bodyValues = ['POST', 'PUT', 'PATCH'].includes(method) ? request.body : null;

    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection?.remoteAddress ||
      null;
    const userAgent = request.headers['user-agent'] || null;

    const needsOldValues = ['PUT', 'PATCH'].includes(method) && action === 'UPDATE';

    const oldRecordPromise = needsOldValues
      ? this.fetchOldRecord(url, request.params)
      : Promise.resolve(null);

    return from(oldRecordPromise).pipe(
      switchMap((oldRecord) =>
        next.handle().pipe(
          tap((responseData) => {
            if (!user?.tenantId) return;

            const itemName = responseData?.product?.name || responseData?.description || oldRecord?.product?.name || null;
            let logOldValues: any = null;
            let logNewValues: any = { __url: url };
            if (itemName) logNewValues.__itemName = itemName;

            if (oldRecord && bodyValues) {
              const diff = this.buildDiff(oldRecord, bodyValues, responseData);
              if (!diff) return; // Skip if nothing changed
              logOldValues = diff.oldValues;
              logNewValues = { ...logNewValues, ...diff.newValues };
            } else if (bodyValues) {
              logNewValues = { ...logNewValues, ...bodyValues };
            }

            this.auditService
              .log({ tenantId: user.tenantId, userId: user.id, action, entityType, entityId, oldValues: logOldValues, newValues: logNewValues, ipAddress, userAgent })
              .catch(() => {});
          }),
        ),
      ),
    );
  }
}
