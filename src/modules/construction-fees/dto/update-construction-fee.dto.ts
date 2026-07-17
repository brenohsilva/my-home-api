import { PartialType } from '@nestjs/swagger';
import { CreateConstructionFeeDto } from './create-construction-fee.dto';

export class UpdateConstructionFeeDto extends PartialType(
  CreateConstructionFeeDto,
) {}
