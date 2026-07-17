import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpcomingPaymentsQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: 3650 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days = 30;

  @ApiPropertyOptional({ default: 5, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 5;
}
