import { PartialType } from '@nestjs/swagger';
import { CreateAdjustmentIndexDto } from './create-adjustment-index.dto';

export class UpdateAdjustmentIndexDto extends PartialType(
  CreateAdjustmentIndexDto,
) {}
