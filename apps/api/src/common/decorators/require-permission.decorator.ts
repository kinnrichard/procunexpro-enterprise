import { SetMetadata } from '@nestjs/common';
import { PermAction } from '../../modules/permissions/permissions.constants';

export const PERMISSION_KEY = 'required_permission';

// Mark an endpoint with the module + action it needs, e.g. @RequirePermission('purchase-orders', 'create')
export const RequirePermission = (module: string, action: PermAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });
