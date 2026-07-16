import { Module } from '@nestjs/common';
import { ConstructionProgressService } from './construction-progress.service';
@Module({
  providers: [ConstructionProgressService],
  exports: [ConstructionProgressService],
})
export class ConstructionProgressModule {}
