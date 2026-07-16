import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConstructionStage } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;

export class CreatePropertyDto {
  @ApiProperty({ example: 'Apartamento 1201' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'Construtora Exemplo' })
  @IsString()
  @Length(2, 160)
  builderName: string;

  @ApiProperty({ example: 'Recife' })
  @IsString()
  @Length(2, 120)
  city: string;

  @ApiProperty({ example: 'PE' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiProperty({ example: 'Rua das Flores, 100' })
  @IsString()
  @Length(2, 255)
  street: string;

  @ApiProperty({ example: '2026-01-20' })
  @IsDateString({ strict: true })
  purchaseDate: string;

  @ApiPropertyOptional({ example: '2026-01-25' })
  @IsOptional()
  @IsDateString({ strict: true })
  builderSignedDate?: string;

  @ApiPropertyOptional({ example: '2026-02-10' })
  @IsOptional()
  @IsDateString({ strict: true })
  bankSignedDate?: string;

  @ApiPropertyOptional({ example: '2029-06-30' })
  @IsOptional()
  @IsDateString({ strict: true })
  expectedKeyDate?: string;

  @ApiProperty({ example: '450000.00', type: String })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  assessedValue: string;

  @ApiProperty({ example: '420000.00', type: String })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  purchaseValue: string;

  @ApiPropertyOptional({ enum: ConstructionStage })
  @IsOptional()
  @IsEnum(ConstructionStage)
  currentStage?: ConstructionStage;

  @ApiPropertyOptional({ example: '12.50', type: String })
  @IsOptional()
  @IsString()
  @Matches(PERCENT_PATTERN)
  progressPercent?: string;
}
