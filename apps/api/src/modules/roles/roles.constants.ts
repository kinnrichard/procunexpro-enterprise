// The 7 built-in roles, seeded per tenant as isSystem=true (can't be deleted).
// SUPERADMIN + ADMIN are also in FULL_ACCESS_ROLES (permissions.constants) and
// always get full access regardless of the matrix.
export const SYSTEM_ROLES: Array<{ key: string; label: string; description: string }> = [
  { key: 'SUPERADMIN', label: 'Super Admin', description: 'Developer — full system access' },
  { key: 'ADMIN', label: 'Admin', description: 'Organization administrator — full access' },
  { key: 'MANAGER', label: 'Manager', description: 'Approves manager-stage purchase requests' },
  { key: 'PROCUREMENT_OFFICER', label: 'Procurement Officer', description: 'Runs RFQs and purchase orders' },
  { key: 'WAREHOUSE_STAFF', label: 'Warehouse Staff', description: 'Manages inventory and stock movements' },
  { key: 'FINANCE_OFFICER', label: 'Finance Officer', description: 'Approves finance-stage requests' },
  { key: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
];
