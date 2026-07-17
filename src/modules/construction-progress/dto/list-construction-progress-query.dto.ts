import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum ConstructionProgressOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListConstructionProgressQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @ApiPropertyOptional({
    enum: ConstructionProgressOrder,
    default: ConstructionProgressOrder.DESC,
  })
  @IsOptional()
  @IsEnum(ConstructionProgressOrder)
  order: ConstructionProgressOrder = ConstructionProgressOrder.DESC;
}
