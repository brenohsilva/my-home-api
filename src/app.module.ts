import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdjustmentIndexesModule } from './modules/adjustment-indexes/adjustment-indexes.module';
import { AuthModule } from './modules/auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { ConstructionFeesModule } from './modules/construction-fees/construction-fees.module';
import { ConstructionProgressModule } from './modules/construction-progress/construction-progress.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FinancingModule } from './modules/financing/financing.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    FinancingModule,
    HealthModule,
    PaymentsModule,
    ExpensesModule,
    ConstructionProgressModule,
    ConstructionFeesModule,
    AdjustmentIndexesModule,
    DashboardModule,
  ],
})
export class AppModule {}
