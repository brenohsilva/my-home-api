import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum PaymentSortBy {
  DUE_DATE = 'dueDate',
  CREATED_AT = 'createdAt',
  EXPECTED_AMOUNT = 'expectedAmount',
}

export enum PaymentSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @ApiPropertyOptional({ enum: PaymentSortBy, default: PaymentSortBy.DUE_DATE })
  @IsOptional()
  @IsEnum(PaymentSortBy)
  sortBy: PaymentSortBy = PaymentSortBy.DUE_DATE;

  @ApiPropertyOptional({
    enum: PaymentSortOrder,
    default: PaymentSortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(PaymentSortOrder)
  sortOrder: PaymentSortOrder = PaymentSortOrder.ASC;
}
