// The 5 built-in inventory types, seeded per tenant as isSystem=true.
// hasComposition = items of this type can have a BOM/composition (and be produced).
export const SYSTEM_INVENTORY_TYPES: Array<{
  key: string; label: string; description: string; hasComposition: boolean; sortOrder: number;
}> = [
  { key: 'product', label: 'Product (Finished Good)', description: 'What you make and sell', hasComposition: true, sortOrder: 1 },
  { key: 'raw_material', label: 'Raw Material', description: 'Inputs consumed in production', hasComposition: false, sortOrder: 2 },
  { key: 'component', label: 'Component / Sub-Assembly', description: 'Made and consumed (semi-finished)', hasComposition: true, sortOrder: 3 },
  { key: 'consumable', label: 'Consumable / Supplies', description: 'Used up, not part of the formula', hasComposition: false, sortOrder: 4 },
  { key: 'packaging', label: 'Packaging', description: 'Bottles, boxes, labels', hasComposition: false, sortOrder: 5 },
];
