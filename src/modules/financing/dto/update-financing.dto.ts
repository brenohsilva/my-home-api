import { PartialType } from '@nestjs/swagger';
import { CreateFinancingDto } from './create-financing.dto';

export class UpdateFinancingDto extends PartialType(CreateFinancingDto) {}
