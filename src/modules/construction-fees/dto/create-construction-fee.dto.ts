import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConstructionFeeDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-01$/, {
    message: 'referenceMonth must be the first day of the month',
  })
  referenceMonth: string;

  @ApiPropertyOptional({ example: 35, nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentageReleased?: number | null;

  @ApiProperty({ example: 850 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2026-07-15', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  paidDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
