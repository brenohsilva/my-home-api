import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConstructionStage } from '@prisma/client';
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

export class CreateConstructionProgressDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-01$/, {
    message: 'referenceMonth must be the first day of the month',
  })
  referenceMonth: string;

  @ApiPropertyOptional({
    enum: ConstructionStage,
    example: ConstructionStage.STRUCTURE,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ConstructionStage)
  stage?: ConstructionStage | null;

  @ApiProperty({ example: 35 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  progressPercent: number;

  @ApiProperty({ example: 42 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  scheduledPercent: number;

  @ApiPropertyOptional({
    example: 'Estrutura do terceiro pavimento concluída',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
