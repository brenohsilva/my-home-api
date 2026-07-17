import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentIndexType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateAdjustmentIndexDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-01$/, {
    message: 'referenceMonth must be the first day of the month',
  })
  referenceMonth: string;

  @ApiProperty({ enum: AdjustmentIndexType, example: AdjustmentIndexType.INCC })
  @IsEnum(AdjustmentIndexType)
  type: AdjustmentIndexType;

  @ApiProperty({
    example: 0.48,
    description: 'Percentual na convenção 0.48 = 0,48%',
  })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 4 })
  @Min(-99.9999)
  @Max(99.9999)
  percentage: number;

  @ApiPropertyOptional({ example: 125, nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(-9999999999.99)
  @Max(9999999999.99)
  amountImpact?: number | null;
}
