import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { StockMovementsService } from './stock-movements.service';

/** Template columns (order = sheet layout). `*` marks required. Headers match the
 *  existing "Stock Movements.xlsx" so those files upload as-is. */
const COLUMNS: { header: string; field: string; width: number; note?: string }[] = [
  { header: 'Movement Type', field: 'type', width: 18, note: 'default TRANSFER_IN' },
  { header: 'Item', field: 'itemName', width: 28, note: 'item name (used if SKU & Batch Code blank)' },
  { header: 'SKU', field: 'sku', width: 20, note: 'optional' },
  { header: 'Batch Code', field: 'batchCode', width: 20, note: 'optional' },
  { header: 'Quantity*', field: 'quantity', width: 12 },
  { header: 'Warehouse*', field: 'warehouse', width: 20 },
  { header: 'Area', field: 'area', width: 18 },
  { header: 'Location', field: 'location', width: 18 },
  { header: 'Manufacturing Date', field: 'manufactureDate', width: 18 },
  { header: 'Expiration Date', field: 'expiryDate', width: 18 },
  { header: 'Reason', field: 'reason', width: 24 },
];

const VALID_TYPES = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'WRITE_OFF'];
const ADD_TYPES = new Set(['PURCHASE', 'TRANSFER_IN', 'RETURN']);
const norm = (s: string) => s.replace(/\*/g, '').trim().toLowerCase();
const FIELD_BY_HEADER = new Map(COLUMNS.map((c) => [norm(c.header), c.field]));

export interface MovementImportResult {
  total: number;
  created: number;
  failed: number;
  errors: { row: number; sku: string; message: string }[];
}

function parseDate(raw: any): Date | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class StockMovementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: StockMovementsService,
  ) {}

  async buildTemplate(tenantId: string): Promise<Buffer> {
    const [warehouses, products] = await Promise.all([
      this.prisma.warehouse.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      this.prisma.product.findMany({ where: { tenantId }, select: { name: true, sku: true, batchCode: true }, take: 200, orderBy: { name: 'asc' } }),
    ]);
    const areas = warehouses.length
      ? await this.prisma.warehouseArea.findMany({ where: { warehouseId: { in: warehouses.map((w) => w.id) } }, select: { name: true, warehouseId: true } })
      : [];
    const locations = warehouses.length
      ? await this.prisma.warehouseLocation.findMany({ where: { warehouseId: { in: warehouses.map((w) => w.id) } }, select: { name: true, warehouseId: true } })
      : [];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Procunex';

    const ws = wb.addWorksheet('Movements');
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.field, width: c.width }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    header.alignment = { vertical: 'middle' };
    header.height = 20;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

    const ref = wb.addWorksheet('Reference');
    ref.columns = [{ width: 4 }, { width: 40 }, { width: 40 }];
    const title = (text: string) => { const r = ref.addRow(['', text]); r.getCell(2).font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' } }; };
    const line = (a = '', b = '') => ref.addRow(['', a, b]);

    title('How to use');
    line('1. One movement per row on the "Movements" sheet. Columns marked * are required.');
    line('2. Movement Type: leave blank for TRANSFER_IN, or use one of the types below.');
    line('3. Identify the item by SKU or Batch Code (both optional, case-insensitive).');
    line('4. If SKU and Batch Code are blank, the Item column is matched by name (must be unique).');
    line('5. Warehouse must already exist. Area/Location are optional and matched within the warehouse.');
    line('6. Manufacturing/Expiration dates are optional (inbound movements carry them to the created lot).');
    line('7. Save as .xlsx (or .csv) and upload it back on the Stock Movements page.');
    line();
    title('Movement Types');
    for (const t of VALID_TYPES) line(t, ADD_TYPES.has(t) ? 'increases stock (inbound)' : 'reduces stock (outbound)');
    line();
    title('Warehouses  (Warehouse  ▸  Areas)');
    for (const w of warehouses) {
      const wAreas = areas.filter((a) => a.warehouseId === w.id).map((a) => a.name);
      line(w.name, wAreas.length ? wAreas.join(', ') : '(no areas)');
    }
    if (warehouses.length === 0) line('(none configured — add warehouses in Settings)');
    line();
    title('Locations (by warehouse)');
    for (const w of warehouses) {
      const wLocs = locations.filter((l) => l.warehouseId === w.id).map((l) => l.name);
      if (wLocs.length) line(w.name, wLocs.join(', '));
    }
    line();
    title('Items (name  ▸  SKU  ▸  Batch Code) — first 200');
    for (const p of products) line(p.name, `${p.sku}${p.batchCode ? '  ▸  ' + p.batchCode : ''}`);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async importMovements(tenantId: string, userId: string, file: Express.Multer.File): Promise<MovementImportResult> {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    const isCsv = /\.csv$/i.test(file.originalname || '') || file.mimetype === 'text/csv';

    const wb = new ExcelJS.Workbook();
    try {
      if (isCsv) await wb.csv.read(Readable.from(file.buffer));
      else await wb.xlsx.load(file.buffer as any);
    } catch {
      throw new BadRequestException('Could not read the file. Please upload the .xlsx template (or a .csv).');
    }

    const ws = wb.getWorksheet('Movements') || wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet to read.');

    const headerRow = ws.getRow(1);
    const colToField = new Map<number, string>();
    headerRow.eachCell((cell, col) => {
      const field = FIELD_BY_HEADER.get(norm(String(cell.value ?? '')));
      if (field) colToField.set(col, field);
    });
    const mapped = [...colToField.values()];
    if (!mapped.includes('quantity') || !mapped.includes('warehouse') || (!mapped.includes('sku') && !mapped.includes('batchCode') && !mapped.includes('itemName'))) {
      throw new BadRequestException('Missing required columns. Use the template (Quantity, Warehouse, and one of SKU / Batch Code / Item are required).');
    }

    // Lookups
    const [products, warehouses] = await Promise.all([
      this.prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true, sku: true, batchCode: true, itemCode: true } }),
      this.prisma.warehouse.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);
    const areas = await this.prisma.warehouseArea.findMany({ where: { warehouseId: { in: warehouses.map((w) => w.id) } }, select: { id: true, name: true, warehouseId: true } });
    const locations = await this.prisma.warehouseLocation.findMany({ where: { warehouseId: { in: warehouses.map((w) => w.id) } }, select: { id: true, name: true, warehouseId: true } });

    const whByName = new Map(warehouses.map((w) => [w.name.toLowerCase(), w.id]));
    const nameCount = new Map<string, number>();
    for (const p of products) nameCount.set(p.name.toLowerCase(), (nameCount.get(p.name.toLowerCase()) ?? 0) + 1);

    const matchCode = (val: string) => products.find((p) => [p.sku, p.batchCode, p.itemCode].some((v) => v && v.toLowerCase() === val));
    const findProduct = (sku: string, batchCode: string, itemName: string) => {
      const s = sku.trim().toLowerCase();
      if (s) { const hit = matchCode(s); return hit ? { product: hit } : { error: `no item with SKU "${sku}"` }; }
      const b = batchCode.trim().toLowerCase();
      if (b) {
        const hit = products.find((p) => p.batchCode && p.batchCode.toLowerCase() === b) || matchCode(b);
        return hit ? { product: hit } : { error: `no item with Batch Code "${batchCode}"` };
      }
      const nm = itemName.trim().toLowerCase();
      if (!nm) return { error: 'SKU, Batch Code or Item is required' };
      if ((nameCount.get(nm) ?? 0) > 1) return { error: `item name "${itemName}" matches multiple items — use SKU or Batch Code` };
      const hit = products.find((p) => p.name.toLowerCase() === nm);
      return hit ? { product: hit } : { error: `no item named "${itemName}"` };
    };

    const result: MovementImportResult = { total: 0, created: 0, failed: 0, errors: [] };
    const rows = ws.getRows(2, ws.rowCount) ?? [];
    for (const row of rows) {
      const rec: Record<string, string> = {};
      for (const [col, field] of colToField) rec[field] = String(row.getCell(col).text ?? '').trim();
      if (Object.values(rec).every((v) => v === '')) continue;
      result.total++;
      const rowNo = row.number;
      const label = rec.sku || rec.batchCode || rec.itemName || '';

      const issues: string[] = [];
      const type = (rec.type ? rec.type.trim().toUpperCase().replace(/\s+/g, '_') : 'TRANSFER_IN');
      if (!VALID_TYPES.includes(type)) issues.push(`invalid Movement Type "${rec.type}"`);
      const qty = Number(rec.quantity);
      if (!rec.quantity || Number.isNaN(qty) || qty <= 0) issues.push(`Quantity must be a number > 0 (got "${rec.quantity}")`);

      const { product, error } = findProduct(rec.sku || '', rec.batchCode || '', rec.itemName || '');
      if (error) issues.push(error);

      const whId = whByName.get((rec.warehouse || '').toLowerCase());
      if (!rec.warehouse) issues.push('Warehouse is required');
      else if (!whId) issues.push(`no warehouse named "${rec.warehouse}"`);

      let areaId: string | null = null;
      let locId: string | null = null;
      if (whId && rec.area) {
        const a = areas.find((x) => x.warehouseId === whId && x.name.toLowerCase() === rec.area.toLowerCase());
        if (!a) issues.push(`no area "${rec.area}" in ${rec.warehouse}`); else areaId = a.id;
      }
      if (whId && rec.location) {
        const l = locations.find((x) => x.warehouseId === whId && x.name.toLowerCase() === rec.location.toLowerCase());
        if (!l) issues.push(`no location "${rec.location}" in ${rec.warehouse}`); else locId = l.id;
      }

      if (issues.length) { result.failed++; result.errors.push({ row: rowNo, sku: label, message: issues.join('; ') }); continue; }

      const isAdd = ADD_TYPES.has(type);
      const data: any = {
        type, productId: product!.id, quantity: qty,
        manufactureDate: parseDate(rec.manufactureDate)?.toISOString() ?? null,
        expiryDate: parseDate(rec.expiryDate)?.toISOString() ?? null,
        reason: rec.reason || 'Bulk import',
      };
      if (isAdd) { data.toWarehouseId = whId; data.toAreaId = areaId; data.toLocationId = locId; }
      else { data.fromWarehouseId = whId; data.fromAreaId = areaId; data.fromLocationId = locId; }

      try {
        await this.movements.create(tenantId, userId, data);
        result.created++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: rowNo, sku: label, message: e?.message || 'Failed to create movement' });
      }
    }

    if (result.total === 0) throw new BadRequestException('No data rows found. Fill in the Movements sheet and try again.');
    return result;
  }
}
