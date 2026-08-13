'use client';

import { PageHeader } from '@/components/page-header';
import { WarehousesConfig } from '@/components/warehouses-config';

// Warehouse management also lives under Settings → Warehouses; this route is kept for direct access.
export default function WarehousesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Warehouses" description="Manage warehouses, areas and storage locations" />
      <WarehousesConfig />
    </div>
  );
}
