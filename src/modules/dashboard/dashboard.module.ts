import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BuildFinancialSummaryUseCase } from './use-cases/build-financial-summary.use-case';
import { BuildKeyDeliveryForecastUseCase } from './use-cases/build-key-delivery-forecast.use-case';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    BuildFinancialSummaryUseCase,
    BuildKeyDeliveryForecastUseCase,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
