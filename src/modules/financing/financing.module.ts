import { Module } from '@nestjs/common';
import { FinancingService } from './financing.service';
@Module({ providers: [FinancingService], exports: [FinancingService] })
export class FinancingModule {}
