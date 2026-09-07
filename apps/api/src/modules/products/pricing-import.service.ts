import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from './products.service';

/** Template columns. `*` marks required. VAT-inclusive cost is derived
 *  (unitCost x (1 + tax rate)), so only VAT-ex + Tax are captured. */
const COLUMNS: { header: string; field: string; width: number; note?: string }[] = [
  { header: 'Item', field: 'itemName', width: 28, note: 'name (used if SKU & Batch Code blank)' },
  { header: 'SKU', field: 'sku', width: 18, note: 'optional' },
  { header: 'Batch Code', field: 'batchCode', width: 18, note: 'optional' },
  { header: 'Vendor*', field: 'vendor', width: 22, note: 'vendor name or code' },
  { header: 'Type', field: 'type', width: 12, note: 'local | imported (default local)' },
  { header: 'Unit Cost (VAT Ex)*', field: 'unitCost', width: 18 },
  { header: 'Tax', field: 'tax', width: 14, note: 'tax name from Settings (for VAT-inc)' },
  { header: 'Selling Price', field: 'sellingPrice', width: 14 },
  { header: 'Packaging Qty', field: 'originalPackagingQty', width: 14 },
  { header: 'Pcs / Pack', field: 'pcsPerPack', width: 12 },
  { header: 'Packaging UoM', field: 'originalPackagingUom', width: 14 },
  { header: 'Currency', field: 'currency', width: 10 },
  { header: 'Min Order Qty', field: 'minOrderQty', width: 14 },
  { header: 'Lead Time (days)', field: 'leadTimeDays', width: 16 },
  { header: 'Notes', field: 'notes', width: 24 },
];

const INT_FIELDS = new Set(['originalPackagingQty', 'pcsPerPack', 'minOrderQty', 'leadTimeDays']);
const norm = (s: string) => s.replace(/\*/g, '').trim().toLowerCase();
const FIELD_BY_HEADER = new Map(COLUMNS.map((c) => [norm(c.header), c.field]));

export interface PricingImportResult {
  total: number; created: number; failed: number;
  errors: { row: number; sku: string; message: string }[];
}

@Injectable()
export class PricingImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async buildTemplate(tenantId: string): Promise<Buffer> {
    const [vendors, taxes, products] = await Promise.all([
      this.prisma.vendor.findMany({ where: { tenantId, status: 'APPROVED' }, select: { name: true, code: true }, orderBy: { name: 'asc' } }),
      this.prisma.tax.findMany({ where: { tenantId, isActive: true }, select: { name: true, rate: true } }),
      this.prisma.product.findMany({ where: { tenantId }, select: { name: true, sku: true, batchCode: true }, take: 200, orderBy: { name: 'asc' } }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Procunex';
    const ws = wb.addWorksheet('Pricing');
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
    line('1. One price per row (one vendor per item). Columns marked * are required.');
    line('2. Identify the item by SKU or Batch Code (optional); else the Item name is matched (must be unique).');
    line('3. Enter Unit Cost (VAT Ex). Pick a Tax to get the VAT-inclusive cost = cost x (1 + rate).');
    line('4. Vendor must already exist and be Approved. Re-uploading updates the existing price for that vendor.');
    line('5. Save as .xlsx (or .csv) and upload it back on the Items page.');
    line();
    title('Vendors (name  ▸  code)');
    for (const v of vendors) line(v.name, v.code || '');
    if (vendors.length === 0) line('(no approved vendors — add/approve vendors first)');
    line();
    title('Taxes (name  ▸  rate %)');
    for (const t of taxes) line(t.name, String(t.rate));
    if (taxes.length === 0) line('(none configured — add taxes in Settings)');
    line();
    title('Items (name  ▸  SKU  ▸  Batch Code) — first 200');
    for (const p of products) line(p.name, `${p.sku}${p.batchCode ? '  ▸  ' + p.batchCode : ''}`);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async importPricing(tenantId: string, file: Express.Multer.File): Promise<PricingImportResult> {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    const isCsv = /\.csv$/i.test(file.originalname || '') || file.mimetype === 'text/csv';
    const wb = new ExcelJS.Workbook();
    try {
      if (isCsv) await wb.csv.read(Readable.from(file.buffer));
      else await wb.xlsx.load(file.buffer as any);
    } catch {
      throw new BadRequestException('Could not read the file. Please upload the .xlsx template (or a .csv).');
    }
    const ws = wb.getWorksheet('Pricing') || wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet to read.');

    const headerRow = ws.getRow(1);
    const colToField = new Map<number, string>();
    headerRow.eachCell((cell, col) => {
      const field = FIELD_BY_HEADER.get(norm(String(cell.value ?? '')));
      if (field) colToField.set(col, field);
    });
    const mapped = [...colToField.values()];
    if (!mapped.includes('vendor') || !mapped.includes('unitCost') || (!mapped.includes('sku') && !mapped.includes('batchCode') && !mapped.includes('itemName'))) {
      throw new BadRequestException('Missing required columns. Use the template (Vendor, Unit Cost, and one of SKU / Batch Code / Item are required).');
    }

    const [products, vendors, taxes] = await Promise.all([
      this.prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true, sku: true, batchCode: true, itemCode: true } }),
      this.prisma.vendor.findMany({ where: { tenantId }, select: { id: true, name: true, code: true, status: true } }),
      this.prisma.tax.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);
    const nameCount = new Map<string, number>();
    for (const p of products) nameCount.set(p.name.toLowerCase(), (nameCount.get(p.name.toLowerCase()) ?? 0) + 1);
    const matchCode = (v: string) => products.find((p) => [p.sku, p.batchCode, p.itemCode].some((x) => x && x.toLowerCase() === v));
    const taxByName = new Map(taxes.map((t) => [t.name.toLowerCase(), t.id]));

    const result: PricingImportResult = { total: 0, created: 0, failed: 0, errors: [] };
    const rows = ws.getRows(2, ws.rowCount) ?? [];
    for (const row of rows) {
      const rec: Record<string, string> = {};
      for (const [col, field] of colToField) rec[field] = String(row.getCell(col).text ?? '').trim();
      if (Object.values(rec).every((v) => v === '')) continue;
      result.total++;
      const rowNo = row.number;
      const label = rec.sku || rec.batchCode || rec.itemName || rec.vendor || '';
      const issues: string[] = [];

      // Item
      let product: any = null;
      const s = (rec.sku || '').toLowerCase(), b = (rec.batchCode || '').toLowerCase(), nm = (rec.itemName || '').toLowerCase();
      if (s) { product = matchCode(s); if (!product) issues.push(`no item with SKU "${rec.sku}"`); }
      else if (b) { product = products.find((p) => p.batchCode && p.batchCode.toLowerCase() === b) || matchCode(b); if (!product) issues.push(`no item with Batch Code "${rec.batchCode}"`); }
      else if (nm) {
        if ((nameCount.get(nm) ?? 0) > 1) issues.push(`item "${rec.itemName}" matches multiple items — use SKU or Batch Code`);
        else { product = products.find((p) => p.name.toLowerCase() === nm); if (!product) issues.push(`no item named "${rec.itemName}"`); }
      } else issues.push('SKU, Batch Code or Item is required');

      // Vendor (name or code)
      const vq = (rec.vendor || '').toLowerCase();
      const vendor = vendors.find((v) => v.name.toLowerCase() === vq || (v.code && v.code.toLowerCase() === vq));
      if (!rec.vendor) issues.push('Vendor is required');
      else if (!vendor) issues.push(`no vendor "${rec.vendor}"`);

      // Tax (optional)
      let taxId: string | null = null;
      if (rec.tax) { taxId = taxByName.get(rec.tax.toLowerCase()) ?? null; if (!taxId) issues.push(`no tax "${rec.tax}"`); }

      const unitCost = Number(rec.unitCost);
      if (rec.unitCost === '' || Number.isNaN(unitCost) || unitCost < 0) issues.push(`Unit Cost must be a number >= 0 (got "${rec.unitCost}")`);

      if (issues.length) { result.failed++; result.errors.push({ row: rowNo, sku: label, message: issues.join('; ') }); continue; }

      const data: any = { vendorId: vendor!.id, unitCost, taxId, type: (rec.type || 'local').toLowerCase() };
      if (rec.sellingPrice) data.sellingPrice = Number(rec.sellingPrice);
      if (rec.currency) data.currency = rec.currency;
      if (rec.originalPackagingUom) data.originalPackagingUom = rec.originalPackagingUom;
      if (rec.notes) data.notes = rec.notes;
      for (const f of INT_FIELDS) { if (rec[f]) { const n = Number.parseInt(rec[f], 10); if (!Number.isNaN(n)) data[f] = n; } }

      try {
        await this.products.upsertPricing(tenantId, product.id, data);
        result.created++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: rowNo, sku: label, message: e?.message || 'Failed to save pricing' });
      }
    }

    if (result.total === 0) throw new BadRequestException('No data rows found. Fill in the Pricing sheet and try again.');
    return result;
  }
}
