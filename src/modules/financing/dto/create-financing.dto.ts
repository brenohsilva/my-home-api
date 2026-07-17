import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinancingSystem } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinancingDto {
  @ApiPropertyOptional({ example: 'Caixa Econômica Federal' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @ApiPropertyOptional({ example: 230000 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  financedAmount?: number;

  @ApiPropertyOptional({ example: 420 })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @ApiPropertyOptional({ example: 7.66 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  interestRateYear?: number;

  @ApiPropertyOptional({ example: 0.616 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  interestRateMonth?: number;

  @ApiPropertyOptional({ enum: FinancingSystem, example: FinancingSystem.SAC })
  @IsOptional()
  @IsEnum(FinancingSystem)
  system?: FinancingSystem;
}
