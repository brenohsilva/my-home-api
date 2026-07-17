import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  Equals,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InstallmentFrequency } from './generate-installments.dto';

export class GenerateIntermediateInstallmentsDto {
  @ApiProperty({ example: 'Parcela intermediária de dezembro' })
  @IsString()
  @MaxLength(180)
  description: string;

  @ApiProperty({
    enum: PaymentType,
    example: PaymentType.INTERMEDIATE_INSTALLMENT,
  })
  @IsEnum(PaymentType)
  @Equals(PaymentType.INTERMEDIATE_INSTALLMENT)
  type: PaymentType;

  @ApiProperty({ example: 3000 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty({ example: '2026-12-10' })
  @IsDateString({ strict: true })
  firstDueDate: string;

  @ApiProperty({ example: 3, maximum: 600 })
  @IsInt()
  @Min(1)
  @Max(600)
  installmentCount: number;

  @ApiProperty({
    enum: InstallmentFrequency,
    example: InstallmentFrequency.YEARLY,
  })
  @IsEnum(InstallmentFrequency)
  @Equals(InstallmentFrequency.YEARLY)
  frequency: InstallmentFrequency;
}
