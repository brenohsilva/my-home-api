import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentIndexType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class ListAdjustmentIndexesQueryDto {
  @ApiPropertyOptional({ enum: AdjustmentIndexType })
  @IsOptional()
  @IsEnum(AdjustmentIndexType)
  type?: AdjustmentIndexType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;
}
