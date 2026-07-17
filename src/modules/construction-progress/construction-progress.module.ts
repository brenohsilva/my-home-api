import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConstructionProgressController } from './construction-progress.controller';
import { ConstructionProgressService } from './construction-progress.service';
import { SyncPropertyProgressUseCase } from './use-cases/sync-property-progress.use-case';

@Module({
  imports: [AuthModule],
  controllers: [ConstructionProgressController],
  providers: [ConstructionProgressService, SyncPropertyProgressUseCase],
  exports: [ConstructionProgressService],
})
export class ConstructionProgressModule {}
