import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from './products.service';

/** Template column headers (order defines the sheet layout). `*` marks required. */
const COLUMNS: { header: string; field: string; width: number; note?: string }[] = [
  { header: 'Name*', field: 'name', width: 28 },
  { header: 'SKU*', field: 'sku', width: 18 },
  { header: 'Inventory Type*', field: 'inventoryType', width: 18, note: 'key or label from Reference' },
  { header: 'Category*', field: 'category', width: 20 },
  { header: 'Sub Category', field: 'subCategory', width: 20 },
  { header: 'Manufacturer*', field: 'manufacturer', width: 22 },
  { header: 'Origin*', field: 'origin', width: 16 },
  { header: 'Unit', field: 'unit', width: 10, note: 'stock unit code, default pcs' },
  { header: 'Barcode', field: 'barcode', width: 16 },
  { header: 'Model Number', field: 'modelNumber', width: 16 },
  { header: 'Description', field: 'description', width: 30 },
  { header: 'Min Stock', field: 'minStock', width: 12 },
  { header: 'Max Stock', field: 'maxStock', width: 12 },
  { header: 'Reorder Point', field: 'reorderPoint', width: 14 },
  { header: 'Reorder Qty', field: 'reorderQuantity', width: 12 },
  { header: 'Shelf Life (days)', field: 'shelfLifeDays', width: 16 },
  { header: 'Requires QC (Yes/No)', field: 'qcRequired', width: 20 },
  { header: 'Selling Price', field: 'sellingPrice', width: 14 },
  { header: 'Cost Price', field: 'costPrice', width: 12 },
  { header: 'Length', field: 'length', width: 10 },
  { header: 'Depth', field: 'depth', width: 10 },
  { header: 'Height', field: 'height', width: 10 },
  { header: 'Weight', field: 'weight', width: 10 },
];

const NUMERIC_FIELDS = new Set(['minStock', 'maxStock', 'reorderPoint', 'reorderQuantity', 'sellingPrice', 'costPrice', 'length', 'depth', 'height', 'weight']);
const norm = (s: string) => s.replace(/\*/g, '').trim().toLowerCase();
const FIELD_BY_HEADER = new Map(COLUMNS.map((c) => [norm(c.header), c.field]));

export interface ImportResult {
  total: number;
  created: number;
  failed: number;
  errors: { row: number; sku: string; message: string }[];
}

@Injectable()
export class ItemImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  // ---- Lookups ---------------------------------------------------------

  private async loadLookups(tenantId: string) {
    const [invTypes, categories, manufacturers, origins, uoms] = await Promise.all([
      this.prisma.inventoryType.findMany({ where: { tenantId } }),
      this.prisma.category.findMany({ where: { tenantId, isActive: true } }),
      this.prisma.manufacturer.findMany({ where: { tenantId, isActive: true } }),
      this.prisma.origin.findMany({ where: { tenantId, isActive: true } }),
      this.prisma.unitOfMeasure.findMany({ where: { tenantId, isActive: true } }),
    ]);

    // Inventory type by key or label → key
    const invTypeByName = new Map<string, string>();
    for (const t of invTypes) { invTypeByName.set(t.key.toLowerCase(), t.key); invTypeByName.set(t.label.toLowerCase(), t.key); }

    const topCats = categories.filter((c) => !c.parentId);
    const catByName = new Map(topCats.map((c) => [c.name.toLowerCase(), c.id]));
    // sub-categories grouped by parent id
    const subByParent = new Map<string, Map<string, string>>();
    for (const c of categories.filter((x) => x.parentId)) {
      if (!subByParent.has(c.parentId!)) subByParent.set(c.parentId!, new Map());
      subByParent.get(c.parentId!)!.set(c.name.toLowerCase(), c.id);
    }

    return {
      invTypes, categories, manufacturers, origins, uoms,
      invTypeByName,
      catByName,
      subByParent,
      mfrByName: new Map(manufacturers.map((m) => [m.name.toLowerCase(), m.id])),
      originByName: new Map(origins.map((o) => [o.name.toLowerCase(), o.id])),
      uomCodes: new Set(uoms.map((u) => u.code.toLowerCase())),
    };
  }

  // ---- Template --------------------------------------------------------

  async buildTemplate(tenantId: string): Promise<Buffer> {
    const lk = await this.loadLookups(tenantId);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Procunex';

    // Items sheet — headers only; data starts on row 2
    const ws = wb.addWorksheet('Items');
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.field, width: c.width }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    header.alignment = { vertical: 'middle' };
    header.height = 20;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

    // Reference sheet
    const ref = wb.addWorksheet('Reference');
    ref.columns = [{ width: 4 }, { width: 40 }, { width: 40 }];
    const title = (text: string) => {
      const r = ref.addRow(['', text]);
      r.getCell(2).font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' } };
    };
    const line = (a = '', b = '') => ref.addRow(['', a, b]);

    title('How to use');
    line('1. Fill one item per row on the "Items" sheet. Columns marked * are required.');
    line('2. For Inventory Type / Category / Sub Category / Manufacturer / Origin, type a value listed below (case-insensitive).');
    line('3. Sub Category must belong to the Category on the same row.');
    line('4. Stock always starts at 0 — add stock later via Goods Receipt / Stock Lots.');
    line('5. Save as .xlsx (or .csv) and upload it back on the Items page.');
    line();
    title('Inventory Types (type the key or label)');
    for (const t of lk.invTypes) line(t.key, t.label);
    line();
    title('Categories  (Category  ▸  Sub Categories)');
    for (const c of lk.categories.filter((x) => !x.parentId)) {
      const subs = [...(lk.subByParent.get(c.id)?.keys() ?? [])];
      line(c.name, subs.length ? subs.join(', ') : '(no sub categories)');
    }
    if (lk.categories.length === 0) line('(none configured — add categories in Settings)');
    line();
    title('Manufacturers');
    for (const m of lk.manufacturers) line(m.name);
    if (lk.manufacturers.length === 0) line('(none configured — add manufacturers in Settings)');
    line();
    title('Origins');
    for (const o of lk.origins) line(o.name);
    if (lk.origins.length === 0) line('(none configured — add origins in Settings)');
    line();
    title('Units (code)');
    line([...lk.uomCodes].join(', ') || 'pcs');

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  // ---- Import ----------------------------------------------------------

  async importItems(tenantId: string, file: Express.Multer.File): Promise<ImportResult> {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    const isCsv = /\.csv$/i.test(file.originalname || '') || file.mimetype === 'text/csv';

    const wb = new ExcelJS.Workbook();
    try {
      if (isCsv) {
        await wb.csv.read(Readable.from(file.buffer));
      } else {
        await wb.xlsx.load(file.buffer as any);
      }
    } catch {
      throw new BadRequestException('Could not read the file. Please upload the .xlsx template (or a .csv).');
    }

    const ws = wb.getWorksheet('Items') || wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet to read.');

    // Map columns from the header row
    const headerRow = ws.getRow(1);
    const colToField = new Map<number, string>();
    headerRow.eachCell((cell, col) => {
      const field = FIELD_BY_HEADER.get(norm(String(cell.value ?? '')));
      if (field) colToField.set(col, field);
    });
    if (![...colToField.values()].includes('name') || ![...colToField.values()].includes('sku')) {
      throw new BadRequestException('Missing required columns. Please use the downloadable template (Name and SKU are required).');
    }

    const lk = await this.loadLookups(tenantId);
    const result: ImportResult = { total: 0, created: 0, failed: 0, errors: [] };

    const rows = ws.getRows(2, ws.rowCount) ?? [];
    for (const row of rows) {
      const rec: Record<string, string> = {};
      for (const [col, field] of colToField) rec[field] = String(row.getCell(col).text ?? '').trim();

      // Skip fully empty rows
      if (Object.values(rec).every((v) => v === '')) continue;
      result.total++;
      const rowNo = row.number;

      const { data, issues } = this.resolveRow(rec, lk);
      if (issues.length) {
        result.failed++;
        result.errors.push({ row: rowNo, sku: rec.sku || '', message: issues.join('; ') });
        continue;
      }
      try {
        await this.products.create(tenantId, data);
        result.created++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ row: rowNo, sku: rec.sku || '', message: e?.message || 'Failed to create item' });
      }
    }

    if (result.total === 0) throw new BadRequestException('No data rows found. Fill in the Items sheet and try again.');
    return result;
  }

  private resolveRow(rec: Record<string, string>, lk: Awaited<ReturnType<ItemImportService['loadLookups']>>) {
    const issues: string[] = [];
    const data: any = {};

    if (!rec.name) issues.push('Name is required');
    else data.name = rec.name;
    if (!rec.sku) issues.push('SKU is required');
    else data.sku = rec.sku;

    // Inventory type (defaults to "product" when blank)
    if (!rec.inventoryType) data.inventoryType = 'product';
    else {
      const key = lk.invTypeByName.get(rec.inventoryType.toLowerCase());
      if (!key) issues.push(`Unknown inventory type "${rec.inventoryType}"`);
      else data.inventoryType = key;
    }

    // Category (required) + optional sub-category
    let categoryId: string | undefined;
    if (!rec.category) issues.push('Category is required');
    else {
      categoryId = lk.catByName.get(rec.category.toLowerCase());
      if (!categoryId) issues.push(`Unknown category "${rec.category}"`);
      else data.categoryId = categoryId;
    }
    if (rec.subCategory) {
      if (!categoryId) issues.push('Sub Category given without a valid Category');
      else {
        const subId = lk.subByParent.get(categoryId)?.get(rec.subCategory.toLowerCase());
        if (!subId) issues.push(`Unknown sub category "${rec.subCategory}" under "${rec.category}"`);
        else data.subCategoryId = subId;
      }
    }

    // Manufacturer + origin (required)
    if (!rec.manufacturer) issues.push('Manufacturer is required');
    else {
      const id = lk.mfrByName.get(rec.manufacturer.toLowerCase());
      if (!id) issues.push(`Unknown manufacturer "${rec.manufacturer}"`);
      else data.manufacturerId = id;
    }
    if (!rec.origin) issues.push('Origin is required');
    else {
      const id = lk.originByName.get(rec.origin.toLowerCase());
      if (!id) issues.push(`Unknown origin "${rec.origin}"`);
      else data.originId = id;
    }

    // Unit (validate against configured UOMs if any exist)
    if (rec.unit) {
      if (lk.uomCodes.size > 0 && !lk.uomCodes.has(rec.unit.toLowerCase())) issues.push(`Unknown unit "${rec.unit}"`);
      else data.unit = rec.unit;
    }

    // Plain optional fields
    data.modelNumber = rec.modelNumber || '';
    if (rec.barcode) data.barcode = rec.barcode;
    if (rec.description) data.description = rec.description;

    // Numerics
    for (const field of NUMERIC_FIELDS) {
      const raw = rec[field];
      if (raw === undefined || raw === '') continue;
      const n = Number(raw);
      if (Number.isNaN(n)) issues.push(`${field} must be a number (got "${raw}")`);
      else data[field] = n;
    }
    if (rec.shelfLifeDays) {
      const n = Number.parseInt(rec.shelfLifeDays, 10);
      if (Number.isNaN(n)) issues.push(`Shelf Life must be a whole number (got "${rec.shelfLifeDays}")`);
      else data.shelfLifeDays = n;
    }
    if (rec.qcRequired) data.qcRequired = /^(yes|y|true|1)$/i.test(rec.qcRequired.trim());

    return { data, issues };
  }
}
