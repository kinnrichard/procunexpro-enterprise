// Roles configurable in the matrix. SUPERADMIN + ADMIN are NOT here — they always have full access.
export const CONFIGURABLE_ROLES = ['MANAGER', 'PROCUREMENT_OFFICER', 'WAREHOUSE_STAFF', 'FINANCE_OFFICER', 'VIEWER'];
export const FULL_ACCESS_ROLES = ['SUPERADMIN', 'ADMIN'];

export const MODULES: Array<{ key: string; label: string }> = [
  { key: 'purchase-requests', label: 'Purchase Requests' },
  { key: 'purchase-orders', label: 'Purchase Orders' },
  { key: 'rfq', label: 'RFQ' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products & Inventory' },
  { key: 'productions', label: 'Production' },
  { key: 'goods-receipts', label: 'Goods Receipts' },
  { key: 'stock-transfers', label: 'Stock Transfers' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'staff', label: 'Staff' },
  { key: 'users', label: 'Users' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

export type PermAction = 'view' | 'create' | 'edit' | 'delete';
