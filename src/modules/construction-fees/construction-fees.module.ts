import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConstructionFeesController } from './construction-fees.controller';
import { ConstructionFeesService } from './construction-fees.service';

@Module({
  imports: [AuthModule],
  controllers: [ConstructionFeesController],
  providers: [ConstructionFeesService],
  exports: [ConstructionFeesService],
})
export class ConstructionFeesModule {}
