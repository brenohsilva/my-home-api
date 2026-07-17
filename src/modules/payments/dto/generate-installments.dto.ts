import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum InstallmentFrequency {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class GenerateInstallmentsDto {
  @ApiProperty({ example: 'Parcela da entrada' })
  @IsString()
  @MaxLength(180)
  description: string;

  @ApiProperty({ enum: PaymentType, example: PaymentType.MONTHLY_INSTALLMENT })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ example: 36, maximum: 600 })
  @IsInt()
  @Min(1)
  @Max(600)
  installmentCount: number;

  @ApiProperty({ example: 700 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  installmentAmount: number;

  @ApiProperty({ example: '2026-02-10' })
  @IsDateString({ strict: true })
  firstDueDate: string;

  @ApiProperty({
    enum: InstallmentFrequency,
    example: InstallmentFrequency.MONTHLY,
  })
  @IsEnum(InstallmentFrequency)
  frequency: InstallmentFrequency;
}
