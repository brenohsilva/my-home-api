import { Module } from '@nestjs/common';
import { AdjustmentIndexesService } from './adjustment-indexes.service';
@Module({
  providers: [AdjustmentIndexesService],
  exports: [AdjustmentIndexesService],
})
export class AdjustmentIndexesModule {}
