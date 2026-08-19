// The master catalog of every widget an admin can place on the dashboard.
// The backend uses this for /catalog, default-layout seeding, and validating
// the `type` on create. The frontend keys its render components off `type`.
//
// `category` groups them in the "Add Widget" browser. `defaultSize` is in
// react-grid-layout units (12-col grid). `configFields` describe the per-widget
// settings the frontend renders generically in the widget settings dialog.

export type WidgetConfigField = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'textarea';
  default?: any;
  min?: number;
  max?: number;
};

export type WidgetCatalogEntry = {
  type: string;
  label: string;
  category: 'KPI' | 'Chart' | 'List' | 'Utility';
  description: string;
  defaultSize: { w: number; h: number };
  configFields?: WidgetConfigField[];
};

const LIMIT_FIELD = (def: number): WidgetConfigField => ({
  key: 'limit',
  label: 'Rows to show',
  type: 'number',
  default: def,
  min: 1,
  max: 50,
});

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  // ---- KPI cards (single number) ----
  { type: 'kpi-total-items', label: 'Total Items', category: 'KPI', description: 'Count of active items.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-inventory-skus', label: 'Inventory SKUs', category: 'KPI', description: 'Number of stocked SKUs.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-total-vendors', label: 'Vendors', category: 'KPI', description: 'Count of active vendors.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-total-prs', label: 'Purchase Requests', category: 'KPI', description: 'Total purchase requests.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-total-pos', label: 'Purchase Orders', category: 'KPI', description: 'Total purchase orders.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-pending-approvals', label: 'Pending Approvals', category: 'KPI', description: 'PRs + POs awaiting approval.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-low-stock', label: 'Low Stock Items', category: 'KPI', description: 'Items at or below reorder point.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-inventory-value', label: 'Inventory Value', category: 'KPI', description: 'Total on-hand value.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-open-rfqs', label: 'Open RFQs', category: 'KPI', description: 'RFQs currently published.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-pending-deliveries', label: 'Pending Deliveries', category: 'KPI', description: 'Delivery receipts not yet signed.', defaultSize: { w: 3, h: 2 } },
  { type: 'kpi-active-productions', label: 'Active Productions', category: 'KPI', description: 'Production runs in progress.', defaultSize: { w: 3, h: 2 } },
  {
    type: 'kpi-expiring-lots', label: 'Expiring Lots', category: 'KPI', description: 'Lots expiring within a window.', defaultSize: { w: 3, h: 2 },
    configFields: [{ key: 'days', label: 'Window (days)', type: 'number', default: 30, min: 1, max: 365 }],
  },
  { type: 'kpi-active-customers', label: 'Active Customers', category: 'KPI', description: 'Count of active customers.', defaultSize: { w: 3, h: 2 } },

  // ---- Charts ----
  {
    type: 'chart-procurement-spend', label: 'Procurement Spend', category: 'Chart', description: 'PO spend over recent months (area chart).', defaultSize: { w: 8, h: 4 },
    configFields: [{ key: 'months', label: 'Months to show', type: 'number', default: 6, min: 3, max: 24 }],
  },
  { type: 'chart-pr-status', label: 'PR Status Breakdown', category: 'Chart', description: 'Purchase requests by status (donut).', defaultSize: { w: 4, h: 4 } },
  { type: 'chart-po-status', label: 'PO Status Breakdown', category: 'Chart', description: 'Purchase orders by status (donut).', defaultSize: { w: 4, h: 4 } },
  { type: 'chart-stock-by-warehouse', label: 'Stock Value by Warehouse', category: 'Chart', description: 'On-hand value per warehouse (bar).', defaultSize: { w: 6, h: 4 } },
  {
    type: 'chart-top-vendors', label: 'Top Vendors by Spend', category: 'Chart', description: 'Highest-spend vendors (bar).', defaultSize: { w: 6, h: 4 },
    configFields: [{ key: 'limit', label: 'Vendors to show', type: 'number', default: 5, min: 3, max: 20 }],
  },
  {
    type: 'chart-movements-trend', label: 'Stock Movements Trend', category: 'Chart', description: 'Inbound vs outbound quantity per month (line).', defaultSize: { w: 8, h: 4 },
    configFields: [{ key: 'months', label: 'Months to show', type: 'number', default: 6, min: 3, max: 24 }],
  },
  { type: 'chart-inventory-by-category', label: 'Inventory by Category', category: 'Chart', description: 'On-hand value per category (pie).', defaultSize: { w: 4, h: 4 } },

  // ---- Lists / tables ----
  { type: 'list-stock-alerts', label: 'Stock Alerts', category: 'List', description: 'Items at or below reorder point.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(10)] },
  { type: 'list-recent-movements', label: 'Recent Stock Movements', category: 'List', description: 'Latest stock movements.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(10)] },
  { type: 'list-recent-prs', label: 'Recent Purchase Requests', category: 'List', description: 'Latest purchase requests.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(5)] },
  { type: 'list-recent-pos', label: 'Recent Purchase Orders', category: 'List', description: 'Latest purchase orders.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(5)] },
  { type: 'list-pending-approvals', label: 'Pending Approvals', category: 'List', description: 'PRs and POs awaiting approval.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(10)] },
  {
    type: 'list-expiring-lots', label: 'Expiring Lots', category: 'List', description: 'Lots nearing expiry.', defaultSize: { w: 6, h: 5 },
    configFields: [{ key: 'days', label: 'Window (days)', type: 'number', default: 30, min: 1, max: 365 }, LIMIT_FIELD(10)],
  },
  { type: 'list-recent-rfqs', label: 'Recent RFQs', category: 'List', description: 'Latest requests for quotation.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(5)] },
  { type: 'list-recent-deliveries', label: 'Recent Deliveries', category: 'List', description: 'Latest delivery receipts.', defaultSize: { w: 6, h: 5 }, configFields: [LIMIT_FIELD(5)] },

  // ---- Utility ----
  { type: 'util-welcome', label: 'Welcome Banner', category: 'Utility', description: 'Greeting + total inventory value hero.', defaultSize: { w: 12, h: 2 } },
  { type: 'util-quick-actions', label: 'Quick Actions', category: 'Utility', description: 'Shortcut buttons to create records.', defaultSize: { w: 6, h: 2 } },
  {
    type: 'util-notes', label: 'Notes', category: 'Utility', description: 'A freeform text note pinned to the dashboard.', defaultSize: { w: 4, h: 3 },
    configFields: [{ key: 'text', label: 'Note text', type: 'textarea', default: '' }],
  },
];

export const WIDGET_TYPES = new Set(WIDGET_CATALOG.map((w) => w.type));

export function catalogEntry(type: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}

// The layout seeded when a tenant opens the dashboard for the first time —
// mirrors the pre-widget dashboard (hero, 7 KPIs, spend chart, alerts, activity).
export const DEFAULT_LAYOUT: Array<{ type: string; x: number; y: number; w: number; h: number; config?: any }> = [
  { type: 'util-welcome', x: 0, y: 0, w: 12, h: 2 },
  { type: 'kpi-total-items', x: 0, y: 2, w: 3, h: 2 },
  { type: 'kpi-inventory-skus', x: 3, y: 2, w: 3, h: 2 },
  { type: 'kpi-total-vendors', x: 6, y: 2, w: 3, h: 2 },
  { type: 'kpi-pending-approvals', x: 9, y: 2, w: 3, h: 2 },
  { type: 'kpi-total-prs', x: 0, y: 4, w: 3, h: 2 },
  { type: 'kpi-total-pos', x: 3, y: 4, w: 3, h: 2 },
  { type: 'kpi-low-stock', x: 6, y: 4, w: 3, h: 2 },
  { type: 'kpi-inventory-value', x: 9, y: 4, w: 3, h: 2 },
  { type: 'chart-procurement-spend', x: 0, y: 6, w: 8, h: 4, config: { months: 6 } },
  { type: 'list-stock-alerts', x: 8, y: 6, w: 4, h: 4, config: { limit: 10 } },
  { type: 'list-recent-movements', x: 0, y: 10, w: 6, h: 5, config: { limit: 10 } },
  { type: 'list-recent-prs', x: 6, y: 10, w: 6, h: 5, config: { limit: 5 } },
];
