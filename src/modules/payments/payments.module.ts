import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GenerateInstallmentsUseCase } from './use-cases/generate-installments.use-case';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, GenerateInstallmentsUseCase],
  exports: [PaymentsService],
})
export class PaymentsModule {}
