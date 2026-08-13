'use client';

import { PageHeader } from '@/components/page-header';
import { WarehousesConfig } from '@/components/warehouses-config';

// Warehouse management also lives under Settings → Warehouses; this route is kept for direct access.
export default function WarehousesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Manage warehouses, areas and storage locations" />
      <WarehousesConfig />
    </div>
  );
}
