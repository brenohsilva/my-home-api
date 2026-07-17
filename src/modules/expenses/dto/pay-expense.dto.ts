import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, Min } from 'class-validator';

export class PayExpenseDto {
  @ApiProperty({ example: '2028-07-10' })
  @IsDateString({ strict: true })
  paidDate: string;

  @ApiProperty({ example: 8300 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount: number;
}
