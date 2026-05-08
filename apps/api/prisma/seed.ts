import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  console.log('Seeding database...');

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { companyName: 'Acme Corporation' },
    update: {},
    create: {
      companyName: 'Acme Corporation',
      schemaName: 'acme',
      domain: 'acme.procunexpro.com',
      status: 'ACTIVE',
      settings: {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timezone: 'America/New_York',
      },
    },
  });

  const hash = await bcrypt.hash('admin123!', 10);

  // Departments
  const engineering = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ENG' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Engineering', code: 'ENG', description: 'Engineering & Development' },
  });

  const operations = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OPS' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Operations', code: 'OPS', description: 'Operations & Logistics' },
  });

  const finance = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FIN' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Finance', code: 'FIN', description: 'Finance & Accounting' },
  });

  const procurement = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PROC' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Procurement', code: 'PROC', description: 'Procurement & Purchasing' },
  });

  const hr = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Human Resources', code: 'HR', description: 'Human Resources & People Ops' },
  });

  // Users
  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'admin' } },
    update: {},
    create: {
      tenantId: tenant.id, username: 'admin', email: 'admin@acme.com',
      passwordHash: hash, firstName: 'System', lastName: 'Admin',
      role: 'ADMIN', departmentId: operations.id,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'jsmith' } },
    update: {},
    create: {
      tenantId: tenant.id, username: 'jsmith', email: 'john.smith@acme.com',
      passwordHash: hash, firstName: 'John', lastName: 'Smith',
      role: 'PROCUREMENT_OFFICER', departmentId: procurement.id,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'mjones' } },
    update: {},
    create: {
      tenantId: tenant.id, username: 'mjones', email: 'mary.jones@acme.com',
      passwordHash: hash, firstName: 'Mary', lastName: 'Jones',
      role: 'MANAGER', departmentId: engineering.id,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'warehouse' } },
    update: {},
    create: {
      tenantId: tenant.id, username: 'warehouse', email: 'warehouse@acme.com',
      passwordHash: hash, firstName: 'Bob', lastName: 'Wilson',
      role: 'WAREHOUSE_STAFF', departmentId: operations.id,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'finance' } },
    update: {},
    create: {
      tenantId: tenant.id, username: 'finance', email: 'finance@acme.com',
      passwordHash: hash, firstName: 'Sarah', lastName: 'Lee',
      role: 'FINANCE_OFFICER', departmentId: finance.id,
    },
  });

  // Categories (root)
  const catOffice = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OFFICE' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Office Supplies', code: 'OFFICE' },
  });

  const catElectronics = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ELEC' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Electronics', code: 'ELEC' },
  });

  const catRaw = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'RAW' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Raw Materials', code: 'RAW' },
  });

  const catFurniture = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FURN' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Furniture', code: 'FURN' },
  });

  const catSafety = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SAFE' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Safety Equipment', code: 'SAFE' },
  });

  // Subcategories
  const subPaper = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OFF-PAPER' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Paper Products', code: 'OFF-PAPER', parentId: catOffice.id },
  });

  const subWriting = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OFF-WRITE' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Writing Instruments', code: 'OFF-WRITE', parentId: catOffice.id },
  });

  const subLaptops = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ELEC-LAPTOP' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Laptops', code: 'ELEC-LAPTOP', parentId: catElectronics.id },
  });

  const subPeripherals = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ELEC-PERIPH' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Peripherals', code: 'ELEC-PERIPH', parentId: catElectronics.id },
  });

  const subMonitors = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ELEC-MON' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Monitors', code: 'ELEC-MON', parentId: catElectronics.id },
  });

  const subMetals = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'RAW-METAL' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Metals', code: 'RAW-METAL', parentId: catRaw.id },
  });

  const subWiring = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'RAW-WIRE' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Wiring', code: 'RAW-WIRE', parentId: catRaw.id },
  });

  const subDesks = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FURN-DESK' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Desks', code: 'FURN-DESK', parentId: catFurniture.id },
  });

  const subChairs = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FURN-CHAIR' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Chairs', code: 'FURN-CHAIR', parentId: catFurniture.id },
  });

  const subEyeProtection = await prisma.category.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SAFE-EYE' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Eye Protection', code: 'SAFE-EYE', parentId: catSafety.id },
  });

  // Taxes
  await prisma.tax.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'VAT' } },
    update: {},
    create: { tenantId: tenant.id, name: 'VAT', rate: 12, isDefault: true },
  });
  await prisma.tax.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Zero-rated' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Zero-rated', rate: 0 },
  });
  await prisma.tax.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Exempt' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Exempt', rate: 0 },
  });

  // Currencies
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'USD' } },
    update: {},
    create: { tenantId: tenant.id, name: 'US Dollar', code: 'USD', symbol: '$', isDefault: true },
  });
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'EUR' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Euro', code: 'EUR', symbol: '€' },
  });
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'GBP' } },
    update: {},
    create: { tenantId: tenant.id, name: 'British Pound', code: 'GBP', symbol: '£' },
  });
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PHP' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Philippine Peso', code: 'PHP', symbol: '₱' },
  });
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'JPY' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Japanese Yen', code: 'JPY', symbol: '¥' },
  });
  await prisma.currency.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'AED' } },
    update: {},
    create: { tenantId: tenant.id, name: 'UAE Dirham', code: 'AED', symbol: 'د.إ' },
  });

  // Manufacturers
  const mfgDoubleA = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Double A' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Double A' },
  });

  const mfgPilot = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Pilot' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Pilot' },
  });

  const mfgDell = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Dell' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Dell' },
  });

  const mfgLogitech = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Logitech' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Logitech' },
  });

  const mfgSamsung = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Samsung' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Samsung' },
  });

  const mfgArcelorMittal = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'ArcelorMittal' } },
    update: {},
    create: { tenantId: tenant.id, name: 'ArcelorMittal' },
  });

  const mfgSouthwire = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Southwire' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Southwire' },
  });

  const mfgFlexiSpot = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'FlexiSpot' } },
    update: {},
    create: { tenantId: tenant.id, name: 'FlexiSpot' },
  });

  const mfgHermanMiller = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Herman Miller' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Herman Miller' },
  });

  const mfg3M = await prisma.manufacturer.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: '3M' } },
    update: {},
    create: { tenantId: tenant.id, name: '3M' },
  });

  // Origins
  const originThailand = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Thailand' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Thailand', code: 'TH' },
  });

  const originJapan = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Japan' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Japan', code: 'JP' },
  });

  const originChina = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'China' } },
    update: {},
    create: { tenantId: tenant.id, name: 'China', code: 'CN' },
  });

  const originUSA = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'USA' } },
    update: {},
    create: { tenantId: tenant.id, name: 'USA', code: 'US' },
  });

  const originSouthKorea = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'South Korea' } },
    update: {},
    create: { tenantId: tenant.id, name: 'South Korea', code: 'KR' },
  });

  const originGermany = await prisma.origin.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Germany' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Germany', code: 'DE' },
  });

  // Vendors
  const vendorABC = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'V-ABC' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'ABC Supplies Inc.', code: 'V-ABC',
      contactPerson: 'Alice Brown', email: 'alice@abcsupplies.com', phone: '+1-555-0101',
      address: '123 Supply St', city: 'New York', country: 'USA',
      status: 'APPROVED', paymentTerms: 'Net 30',
      bankName: 'Chase Bank', bankAccount: '****1234',
      approvedAt: new Date(),
    },
  });

  const vendorTech = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'V-TECH' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'TechParts Global', code: 'V-TECH',
      contactPerson: 'David Chen', email: 'david@techparts.com', phone: '+1-555-0202',
      address: '456 Tech Ave', city: 'San Francisco', country: 'USA',
      status: 'APPROVED', paymentTerms: 'Net 45',
      bankName: 'Wells Fargo', bankAccount: '****5678',
      approvedAt: new Date(),
    },
  });

  const vendorGlobal = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'V-GLB' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'Global Materials Co.', code: 'V-GLB',
      contactPerson: 'Eva Martinez', email: 'eva@globalmaterials.com', phone: '+1-555-0303',
      address: '789 Industrial Blvd', city: 'Houston', country: 'USA',
      status: 'PENDING', paymentTerms: 'Net 60',
    },
  });

  const vendorOffice = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'V-OFC' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'Office Depot Pro', code: 'V-OFC',
      contactPerson: 'Frank White', email: 'frank@officedepotpro.com', phone: '+1-555-0404',
      address: '321 Commerce Dr', city: 'Chicago', country: 'USA',
      status: 'APPROVED', paymentTerms: 'Net 30',
      approvedAt: new Date(),
    },
  });

  // Warehouses
  const whMain = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'WH-MAIN' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'Main Warehouse', code: 'WH-MAIN',
      address: '100 Warehouse Way', city: 'New York',
    },
  });

  const whSecondary = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'WH-SEC' } },
    update: {},
    create: {
      tenantId: tenant.id, name: 'Secondary Warehouse', code: 'WH-SEC',
      address: '200 Storage Rd', city: 'Newark',
    },
  });

  // Warehouse locations
  await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: whMain.id, code: 'A1' } },
    update: {},
    create: { warehouseId: whMain.id, name: 'Aisle A, Shelf 1', code: 'A1' },
  });
  await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: whMain.id, code: 'A2' } },
    update: {},
    create: { warehouseId: whMain.id, name: 'Aisle A, Shelf 2', code: 'A2' },
  });
  await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: whMain.id, code: 'B1' } },
    update: {},
    create: { warehouseId: whMain.id, name: 'Aisle B, Shelf 1', code: 'B1' },
  });

  // Products
  const products = [
    { name: 'A4 Paper (500 sheets)', sku: 'OFF-001', manufacturerId: mfgDoubleA.id, modelNumber: 'DA-A4-500', categoryId: catOffice.id, subCategoryId: subPaper.id, vendorId: vendorOffice.id, originId: originThailand.id, unit: 'ream', costPrice: 5.99, sellingPrice: 8.99, currentStock: 150, minStock: 20, maxStock: 500, reorderPoint: 30, reorderQuantity: 100, originalPackagingQty: 5, pcsPerPack: 5, originalPackagingUom: 'ream', sellingPackagingQty: 1, sellingPackagingUom: 'ream', warehouseId: whMain.id },
    { name: 'Ballpoint Pens (Box of 12)', sku: 'OFF-002', manufacturerId: mfgPilot.id, modelNumber: 'PIL-BP12', categoryId: catOffice.id, subCategoryId: subWriting.id, vendorId: vendorABC.id, originId: originJapan.id, unit: 'box', costPrice: 3.49, sellingPrice: 5.99, currentStock: 80, minStock: 10, maxStock: 200, reorderPoint: 20, reorderQuantity: 50, originalPackagingQty: 12, pcsPerPack: 12, originalPackagingUom: 'pcs', sellingPackagingQty: 1, sellingPackagingUom: 'box', warehouseId: whMain.id },
    { name: 'Laptop - Dell XPS 15', sku: 'ELEC-001', manufacturerId: mfgDell.id, modelNumber: 'XPS-15-9530', categoryId: catElectronics.id, subCategoryId: subLaptops.id, vendorId: vendorTech.id, originId: originChina.id, unit: 'unit', costPrice: 1299.99, sellingPrice: 1599.99, currentStock: 12, minStock: 3, maxStock: 30, reorderPoint: 5, reorderQuantity: 10, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'unit', sellingPackagingQty: 1, sellingPackagingUom: 'unit', warehouseId: whMain.id },
    { name: 'Wireless Mouse', sku: 'ELEC-002', manufacturerId: mfgLogitech.id, modelNumber: 'MX-MASTER-3S', categoryId: catElectronics.id, subCategoryId: subPeripherals.id, vendorId: vendorTech.id, originId: originChina.id, unit: 'unit', costPrice: 24.99, sellingPrice: 39.99, currentStock: 45, minStock: 10, maxStock: 100, reorderPoint: 15, reorderQuantity: 30, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'unit', sellingPackagingQty: 1, sellingPackagingUom: 'unit', warehouseId: whMain.id },
    { name: '27" Monitor', sku: 'ELEC-003', manufacturerId: mfgSamsung.id, modelNumber: 'LS27A800', categoryId: catElectronics.id, subCategoryId: subMonitors.id, vendorId: vendorTech.id, originId: originSouthKorea.id, unit: 'unit', costPrice: 349.99, sellingPrice: 449.99, currentStock: 8, minStock: 2, maxStock: 20, reorderPoint: 4, reorderQuantity: 10, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'unit', sellingPackagingQty: 1, sellingPackagingUom: 'unit', warehouseId: whMain.id },
    { name: 'Steel Sheets (4x8)', sku: 'RAW-001', manufacturerId: mfgArcelorMittal.id, modelNumber: 'AM-SS-4X8', categoryId: catRaw.id, subCategoryId: subMetals.id, vendorId: vendorGlobal.id, originId: originUSA.id, unit: 'sheet', costPrice: 89.99, sellingPrice: 0, currentStock: 3, minStock: 5, maxStock: 50, reorderPoint: 10, reorderQuantity: 20, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'sheet', sellingPackagingQty: 1, sellingPackagingUom: 'sheet', warehouseId: whSecondary.id },
    { name: 'Copper Wire (100m)', sku: 'RAW-002', manufacturerId: mfgSouthwire.id, modelNumber: 'SW-CW-100M', categoryId: catRaw.id, subCategoryId: subWiring.id, vendorId: vendorGlobal.id, originId: originUSA.id, unit: 'roll', costPrice: 45.50, sellingPrice: 0, currentStock: 7, minStock: 3, maxStock: 30, reorderPoint: 5, reorderQuantity: 15, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'roll', sellingPackagingQty: 1, sellingPackagingUom: 'roll', warehouseId: whSecondary.id },
    { name: 'Office Desk - Standing', sku: 'FURN-001', manufacturerId: mfgFlexiSpot.id, modelNumber: 'E7-PRO', categoryId: catFurniture.id, subCategoryId: subDesks.id, vendorId: vendorOffice.id, originId: originChina.id, unit: 'unit', costPrice: 599.99, sellingPrice: 849.99, currentStock: 4, minStock: 2, maxStock: 15, reorderPoint: 3, reorderQuantity: 5, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'unit', sellingPackagingQty: 1, sellingPackagingUom: 'unit', warehouseId: whMain.id },
    { name: 'Ergonomic Chair', sku: 'FURN-002', manufacturerId: mfgHermanMiller.id, modelNumber: 'HM-AERON-B', categoryId: catFurniture.id, subCategoryId: subChairs.id, vendorId: vendorOffice.id, originId: originUSA.id, unit: 'unit', costPrice: 449.99, sellingPrice: 649.99, currentStock: 6, minStock: 2, maxStock: 15, reorderPoint: 3, reorderQuantity: 5, originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'unit', sellingPackagingQty: 1, sellingPackagingUom: 'unit', warehouseId: whMain.id },
    { name: 'Safety Goggles', sku: 'SAFE-001', manufacturerId: mfg3M.id, modelNumber: '3M-GG501', categoryId: catSafety.id, subCategoryId: subEyeProtection.id, vendorId: vendorABC.id, originId: originUSA.id, unit: 'pair', costPrice: 12.99, sellingPrice: 19.99, currentStock: 25, minStock: 10, maxStock: 200, reorderPoint: 15, reorderQuantity: 50, originalPackagingQty: 10, pcsPerPack: 10, originalPackagingUom: 'pcs', sellingPackagingQty: 1, sellingPackagingUom: 'pair', warehouseId: whSecondary.id },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: {},
      create: { tenantId: tenant.id, slug: slugify(p.name), ...p },
    });
  }

  // Sample Purchase Request
  const pr = await prisma.purchaseRequest.upsert({
    where: { tenantId_requestNumber: { tenantId: tenant.id, requestNumber: 'PR-20260501-0001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      requestNumber: 'PR-20260501-0001',
      title: 'Q2 Office Supplies Restock',
      description: 'Quarterly office supplies restock for Engineering department',
      requestedById: admin.id,
      departmentId: engineering.id,
      priority: 'MEDIUM',
      status: 'APPROVED',
      totalAmount: 149.35,
      approvedAt: new Date(),
    },
  });

  // PR Items
  const paper = await prisma.product.findUnique({ where: { tenantId_sku: { tenantId: tenant.id, sku: 'OFF-001' } } });
  const pens = await prisma.product.findUnique({ where: { tenantId_sku: { tenantId: tenant.id, sku: 'OFF-002' } } });

  await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: pr.id } });
  await prisma.purchaseRequestItem.createMany({
    data: [
      { purchaseRequestId: pr.id, itemNumber: 1, description: 'A4 Copy Paper (Ream)', uom: 'PCS', quantity: 20, estimatedPrice: 5.99, totalPrice: 119.80, productId: paper?.id ?? null },
      { purchaseRequestId: pr.id, itemNumber: 2, description: 'Ballpoint Pens (Box of 12)', uom: 'BOX', quantity: 5, estimatedPrice: 3.49, totalPrice: 17.45, productId: pens?.id ?? null },
    ],
  });

  // Sample Purchase Order
  const po = await prisma.purchaseOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: 'PO-20260502-0001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      orderNumber: 'PO-20260502-0001',
      purchaseRequestId: pr.id,
      vendorId: vendorOffice.id,
      createdById: admin.id,
      status: 'SENT',
      priority: 'MEDIUM',
      subtotal: 149.35,
      totalAmount: 149.35,
      paymentTerms: 'Net 30',
      approvedAt: new Date(),
      sentAt: new Date(),
    },
  });

  if (paper && pens) {
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
    await prisma.purchaseOrderItem.createMany({
      data: [
        { purchaseOrderId: po.id, productId: paper.id, quantity: 20, unitPrice: 5.99, totalPrice: 119.80 },
        { purchaseOrderId: po.id, productId: pens.id, quantity: 5, unitPrice: 3.49, totalPrice: 17.45 },
      ],
    });
  }

  // Sample Stock Movements
  if (paper) {
    await prisma.stockMovement.upsert({
      where: { tenantId_referenceNumber: { tenantId: tenant.id, referenceNumber: 'SM-20260501-0001' } },
      update: {},
      create: {
        tenantId: tenant.id, referenceNumber: 'SM-20260501-0001',
        productId: paper.id, type: 'PURCHASE', quantity: 100,
        toWarehouseId: whMain.id, reason: 'Initial stock',
      },
    });
  }

  console.log('Seed complete!');
  console.log('');
  console.log('Demo login:');
  console.log('  Company: Acme Corporation');
  console.log('  Username: admin');
  console.log('  Password: admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
