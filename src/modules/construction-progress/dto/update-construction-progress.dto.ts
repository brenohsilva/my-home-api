import { PartialType } from '@nestjs/swagger';
import { CreateConstructionProgressDto } from './create-construction-progress.dto';

export class UpdateConstructionProgressDto extends PartialType(
  CreateConstructionProgressDto,
) {}
