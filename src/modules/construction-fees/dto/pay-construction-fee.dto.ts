import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class PayConstructionFeeDto {
  @ApiProperty({ example: '2026-07-15' })
  @IsDateString({ strict: true })
  paidDate: string;
}
