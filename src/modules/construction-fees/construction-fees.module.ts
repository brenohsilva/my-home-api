import { Module } from '@nestjs/common';
import { ConstructionFeesService } from './construction-fees.service';
@Module({
  providers: [ConstructionFeesService],
  exports: [ConstructionFeesService],
})
export class ConstructionFeesModule {}
