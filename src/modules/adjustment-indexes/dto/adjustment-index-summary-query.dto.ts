import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentIndexType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AdjustmentIndexSummaryQueryDto {
  @ApiPropertyOptional({ enum: AdjustmentIndexType, example: 'INCC' })
  @IsOptional()
  @IsEnum(AdjustmentIndexType)
  type?: AdjustmentIndexType;
}
