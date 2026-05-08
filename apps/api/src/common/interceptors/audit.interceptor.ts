import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '@prisma/client';

const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  POST: 'CREATE' as AuditAction,
  PUT: 'UPDATE' as AuditAction,
  PATCH: 'UPDATE' as AuditAction,
  DELETE: 'DELETE' as AuditAction,
};

const SKIP_ROUTES = ['/api/auth', '/api/health', '/health'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

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

    const action = METHOD_ACTION_MAP[method];
    const user = request.user;

    // Extract entityType from route path (e.g., '/api/vendors/123' -> 'vendors')
    const pathSegments = url.replace(/^\/api\//, '').split('/');
    const entityType = pathSegments[0] || 'unknown';

    // Extract entityId from route params
    const entityId = request.params?.id || null;

    // Capture request body for POST/PUT
    const newValues = ['POST', 'PUT', 'PATCH'].includes(method) ? request.body : null;

    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection?.remoteAddress ||
      null;
    const userAgent = request.headers['user-agent'] || null;

    return next.handle().pipe(
      tap(() => {
        // Fire and forget - don't block the response
        if (user?.tenantId) {
          this.auditService
            .log({
              tenantId: user.tenantId,
              userId: user.id,
              action,
              entityType,
              entityId,
              newValues,
              ipAddress,
              userAgent,
            })
            .catch(() => {
              // Silently ignore audit logging errors
            });
        }
      }),
    );
  }
}
