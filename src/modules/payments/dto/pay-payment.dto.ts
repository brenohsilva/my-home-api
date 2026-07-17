import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, Min } from 'class-validator';

export class PayPaymentDto {
  @ApiProperty({ example: '2026-07-10' })
  @IsDateString({ strict: true })
  paidDate: string;

  @ApiProperty({ example: 700 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount: number;
}
