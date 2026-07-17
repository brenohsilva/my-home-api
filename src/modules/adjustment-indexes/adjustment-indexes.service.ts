import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdjustmentIndex, AdjustmentIndexType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustmentIndexSummaryQueryDto } from './dto/adjustment-index-summary-query.dto';
import { CreateAdjustmentIndexDto } from './dto/create-adjustment-index.dto';
import { ListAdjustmentIndexesQueryDto } from './dto/list-adjustment-indexes-query.dto';
import { UpdateAdjustmentIndexDto } from './dto/update-adjustment-index.dto';

interface AdjustmentIndexUpdateData {
  referenceMonth?: Date;
  type?: AdjustmentIndexType;
  percentage?: Prisma.Decimal;
  amountImpact?: Prisma.Decimal | null;
}

@Injectable()
export class AdjustmentIndexesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreateAdjustmentIndexDto,
  ): Promise<AdjustmentIndex> {
    await this.ensureOwnedProperty(userId, propertyId);

    try {
      return await this.prisma.adjustmentIndex.create({
        data: {
          propertyId,
          referenceMonth: this.parseDate(dto.referenceMonth),
          type: dto.type,
          percentage: new Prisma.Decimal(dto.percentage),
          amountImpact:
            dto.amountImpact === undefined || dto.amountImpact === null
              ? null
              : new Prisma.Decimal(dto.amountImpact),
        },
      });
    } catch (error: unknown) {
      this.handleUniqueConstraint(error);
      throw error;
    }
  }

  async findAll(
    userId: string,
    propertyId: string,
    query: ListAdjustmentIndexesQueryDto,
  ): Promise<AdjustmentIndex[]> {
    await this.ensureOwnedProperty(userId, propertyId);
    const where = this.buildListWhere(propertyId, query);

    return this.prisma.adjustmentIndex.findMany({
      where,
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(
    userId: string,
    propertyId: string,
    adjustmentIndexId: string,
  ): Promise<AdjustmentIndex> {
    const adjustmentIndex = await this.prisma.adjustmentIndex.findFirst({
      where: {
        id: adjustmentIndexId,
        propertyId,
        property: { userId },
      },
    });
    if (!adjustmentIndex) {
      throw new NotFoundException('Índice de reajuste não encontrado');
    }
    return adjustmentIndex;
  }

  async update(
    userId: string,
    propertyId: string,
    adjustmentIndexId: string,
    dto: UpdateAdjustmentIndexDto,
  ): Promise<AdjustmentIndex> {
    await this.findOne(userId, propertyId, adjustmentIndexId);

    try {
      return await this.prisma.adjustmentIndex.update({
        where: { id: adjustmentIndexId },
        data: this.toUpdateData(dto),
      });
    } catch (error: unknown) {
      this.handleUniqueConstraint(error);
      throw error;
    }
  }

  async remove(
    userId: string,
    propertyId: string,
    adjustmentIndexId: string,
  ): Promise<void> {
    await this.findOne(userId, propertyId, adjustmentIndexId);
    await this.prisma.adjustmentIndex.delete({
      where: { id: adjustmentIndexId },
    });
  }

  async summary(
    userId: string,
    propertyId: string,
    query: AdjustmentIndexSummaryQueryDto,
  ) {
    const property = await this.ensureOwnedProperty(userId, propertyId);
    const adjustmentIndexes = await this.prisma.adjustmentIndex.findMany({
      where: {
        propertyId,
        ...(query.type && { type: query.type }),
      },
      orderBy: [{ referenceMonth: 'asc' }, { createdAt: 'asc' }],
      select: { percentage: true, amountImpact: true },
    });
    const accumulatedFactor = adjustmentIndexes.reduce(
      (factor, index) =>
        factor.times(new Prisma.Decimal(1).plus(index.percentage.div(100))),
      new Prisma.Decimal(1),
    );
    const accumulatedPercentage = accumulatedFactor
      .minus(1)
      .times(100)
      .toDecimalPlaces(4);
    const totalAmountImpact = adjustmentIndexes.reduce(
      (total, index) => total.plus(index.amountImpact ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      data: {
        type: query.type ?? null,
        accumulatedPercentage,
        totalAmountImpact,
        initialPurchaseValue: property.purchaseValue,
        estimatedAdjustedValue: property.purchaseValue.plus(totalAmountImpact),
      },
    };
  }

  private buildListWhere(
    propertyId: string,
    query: ListAdjustmentIndexesQueryDto,
  ): Prisma.AdjustmentIndexWhereInput {
    if (
      query.startDate &&
      query.endDate &&
      this.parseDate(query.startDate) > this.parseDate(query.endDate)
    ) {
      throw new BadRequestException(
        'startDate não pode ser posterior a endDate',
      );
    }
    const referenceMonth: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: this.parseDate(query.startDate) }),
      ...(query.endDate && {
        lte: this.endOfDay(this.parseDate(query.endDate)),
      }),
    };

    return {
      propertyId,
      ...(query.type && { type: query.type }),
      ...(Object.keys(referenceMonth).length > 0 && { referenceMonth }),
    };
  }

  private toUpdateData(
    dto: UpdateAdjustmentIndexDto,
  ): AdjustmentIndexUpdateData {
    return {
      ...(dto.referenceMonth !== undefined && {
        referenceMonth: this.parseDate(dto.referenceMonth),
      }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.percentage !== undefined && {
        percentage: new Prisma.Decimal(dto.percentage),
      }),
      ...(dto.amountImpact !== undefined && {
        amountImpact:
          dto.amountImpact === null
            ? null
            : new Prisma.Decimal(dto.amountImpact),
      }),
    };
  }

  private async ensureOwnedProperty(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, userId },
      select: { id: true, purchaseValue: true },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
    return property;
  }

  private handleUniqueConstraint(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe um índice deste tipo para o mês informado',
      );
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private endOfDay(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }
}
