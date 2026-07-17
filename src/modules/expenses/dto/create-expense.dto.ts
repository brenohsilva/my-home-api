import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Previsão de ITBI' })
  @IsString()
  @Matches(/\S/, {
    message: 'description must contain non-whitespace characters',
  })
  @MaxLength(180)
  description: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.ITBI })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2028-07-10', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string | null;

  @ApiProperty({ example: 8500 })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  expectedAmount: number;

  @ApiPropertyOptional({ example: '2028-07-10', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  paidDate?: string | null;

  @ApiPropertyOptional({ example: 8300, nullable: true })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number | null;

  @ApiPropertyOptional({
    example: 'Valor estimado para entrega das chaves',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
