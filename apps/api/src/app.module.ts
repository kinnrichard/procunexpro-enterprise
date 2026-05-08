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
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { TaxesModule } from './modules/taxes/taxes.module';
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
    CurrenciesModule,
    TaxesModule,
    UploadsModule,
  ],
})
export class AppModule {}
