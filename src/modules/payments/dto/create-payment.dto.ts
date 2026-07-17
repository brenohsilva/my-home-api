import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'Entrada inicial' })
  @IsString()
  @MaxLength(180)
  description: string;

  @ApiProperty({ enum: PaymentType, example: PaymentType.DOWN_PAYMENT })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ example: '2026-01-10' })
  @IsDateString({ strict: true })
  dueDate: string;

  @ApiProperty({ example: 7000 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  expectedAmount: number;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2026-01-10', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  paidDate?: string | null;

  @ApiPropertyOptional({ example: 7000, nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
