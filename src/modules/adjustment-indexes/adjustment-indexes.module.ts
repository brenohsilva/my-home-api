import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdjustmentIndexesController } from './adjustment-indexes.controller';
import { AdjustmentIndexesService } from './adjustment-indexes.service';

@Module({
  imports: [AuthModule],
  controllers: [AdjustmentIndexesController],
  providers: [AdjustmentIndexesService],
  exports: [AdjustmentIndexesService],
})
export class AdjustmentIndexesModule {}
