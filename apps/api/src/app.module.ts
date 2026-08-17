import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ProductsModule } from './modules/products/products.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { PurchaseRequestsModule } from './modules/purchase-requests/purchase-requests.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { ProductionsModule } from './modules/productions/productions.module';
import { UnitsOfMeasureModule } from './modules/units-of-measure/units-of-measure.module';
import { StockLotsModule } from './modules/stock-lots/stock-lots.module';
import { InventoryBalanceModule } from './modules/inventory-balance/inventory-balance.module';
import { ReplenishmentModule } from './modules/replenishment/replenishment.module';
import { CustomersModule } from './modules/customers/customers.module';
import { StaffModule } from './modules/staff/staff.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { InventoryTypesModule } from './modules/inventory-types/inventory-types.module';
import { LocationsModule } from './modules/locations/locations.module';
import { PublicItemsModule } from './modules/public-items/public-items.module';
import { LaborRatesModule } from './modules/labor-rates/labor-rates.module';
import { GoodsReceiptsModule } from './modules/goods-receipts/goods-receipts.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { DeliveryReceiptsModule } from './modules/delivery-receipts/delivery-receipts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { SupplierScoringModule } from './modules/supplier-scoring/supplier-scoring.module';
import { RfqModule } from './modules/rfq/rfq.module';
import { SpendAnalyticsModule } from './modules/spend-analytics/spend-analytics.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { AuditModule } from './modules/audit/audit.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ManufacturersModule } from './modules/manufacturers/manufacturers.module';
import { OriginsModule } from './modules/origins/origins.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { TaxesModule } from './modules/taxes/taxes.module';
import { PurchaseTermsModule } from './modules/purchase-terms/purchase-terms.module';
import { DeliveryTermsModule } from './modules/delivery-terms/delivery-terms.module';
import { DeliveryTypesModule } from './modules/delivery-types/delivery-types.module';
import { GlAccountsModule } from './modules/gl-accounts/gl-accounts.module';
import { CommentsModule } from './modules/comments/comments.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    CategoriesModule,
    VendorsModule,
    ProductsModule,
    WarehousesModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    StockMovementsModule,
    ProductionsModule,
    UnitsOfMeasureModule,
    StockLotsModule,
    InventoryBalanceModule,
    ReplenishmentModule,
    CustomersModule,
    StaffModule,
    PermissionsModule,
    RolesModule,
    InventoryTypesModule,
    LocationsModule,
    PublicItemsModule,
    LaborRatesModule,
    GoodsReceiptsModule,
    StockTransfersModule,
    ApprovalsModule,
    DeliveryReceiptsModule,
    DashboardModule,
    HealthModule,
    BudgetsModule,
    ContractsModule,
    SupplierScoringModule,
    RfqModule,
    SpendAnalyticsModule,
    WorkflowsModule,
    AuditModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    ManufacturersModule,
    OriginsModule,
    TenantsModule,
    CompaniesModule,
    CurrenciesModule,
    TaxesModule,
    PurchaseTermsModule,
    DeliveryTermsModule,
    DeliveryTypesModule,
    GlAccountsModule,
    CommentsModule,
    UploadsModule,
  ],
})
export class AppModule {}
