import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConstructionFee, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConstructionFeeDto } from './dto/create-construction-fee.dto';
import { ListConstructionFeesQueryDto } from './dto/list-construction-fees-query.dto';
import { PayConstructionFeeDto } from './dto/pay-construction-fee.dto';
import { UpdateConstructionFeeDto } from './dto/update-construction-fee.dto';

interface ConstructionFeeUpdateData {
  referenceMonth?: Date;
  percentageReleased?: Prisma.Decimal | null;
  amount?: Prisma.Decimal;
  status?: PaymentStatus;
  paidDate?: Date | null;
  notes?: string | null;
}

@Injectable()
export class ConstructionFeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreateConstructionFeeDto,
  ): Promise<ConstructionFee> {
    await this.ensureOwnedProperty(userId, propertyId);
    const status = dto.status ?? PaymentStatus.PENDING;
    const paidDate = dto.paidDate ? this.parseDate(dto.paidDate) : null;
    this.validateFeeState(status, paidDate);

    return this.prisma.constructionFee.create({
      data: {
        propertyId,
        referenceMonth: this.parseDate(dto.referenceMonth),
        percentageReleased:
          dto.percentageReleased === undefined ||
          dto.percentageReleased === null
            ? null
            : new Prisma.Decimal(dto.percentageReleased),
        amount: new Prisma.Decimal(dto.amount),
        status,
        paidDate,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async findAll(
    userId: string,
    propertyId: string,
    query: ListConstructionFeesQueryDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    const where = this.buildListWhere(propertyId, query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.constructionFee.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.constructionFee.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(
    userId: string,
    propertyId: string,
    constructionFeeId: string,
  ): Promise<ConstructionFee> {
    const constructionFee = await this.prisma.constructionFee.findFirst({
      where: {
        id: constructionFeeId,
        propertyId,
        property: { userId },
      },
    });
    if (!constructionFee) {
      throw new NotFoundException('Taxa de obra não encontrada');
    }
    return constructionFee;
  }

  async update(
    userId: string,
    propertyId: string,
    constructionFeeId: string,
    dto: UpdateConstructionFeeDto,
  ): Promise<ConstructionFee> {
    const current = await this.findOne(userId, propertyId, constructionFeeId);
    const data = this.toUpdateData(dto);
    const resultingStatus = dto.status ?? current.status;
    const resultingPaidDate =
      data.paidDate !== undefined ? data.paidDate : current.paidDate;
    this.validateFeeState(resultingStatus, resultingPaidDate);

    return this.prisma.constructionFee.update({
      where: { id: constructionFeeId },
      data,
    });
  }

  async pay(
    userId: string,
    propertyId: string,
    constructionFeeId: string,
    dto: PayConstructionFeeDto,
  ): Promise<ConstructionFee> {
    await this.findOne(userId, propertyId, constructionFeeId);
    return this.prisma.constructionFee.update({
      where: { id: constructionFeeId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: this.parseDate(dto.paidDate),
      },
    });
  }

  async remove(
    userId: string,
    propertyId: string,
    constructionFeeId: string,
  ): Promise<void> {
    await this.findOne(userId, propertyId, constructionFeeId);
    await this.prisma.constructionFee.delete({
      where: { id: constructionFeeId },
    });
  }

  async summary(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const pendingStatuses = [PaymentStatus.PENDING, PaymentStatus.OVERDUE];
    const [paid, pending, overall, recent] = await this.prisma.$transaction([
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: { in: pendingStatuses } },
        _sum: { amount: true },
      }),
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: { not: PaymentStatus.CANCELED } },
        _avg: { amount: true },
        _max: { amount: true },
      }),
      this.prisma.constructionFee.findMany({
        where: { propertyId, status: { not: PaymentStatus.CANCELED } },
        orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
        select: { amount: true },
        take: 2,
      }),
    ]);
    const lastAmount = recent[0]?.amount ?? new Prisma.Decimal(0);
    const previousAmount = recent[1]?.amount;

    return {
      data: {
        totalPaid: paid._sum.amount ?? new Prisma.Decimal(0),
        totalPending: pending._sum.amount ?? new Prisma.Decimal(0),
        averageAmount: overall._avg.amount ?? new Prisma.Decimal(0),
        highestAmount: overall._max.amount ?? new Prisma.Decimal(0),
        lastAmount,
        growthPercentage: this.calculateGrowth(lastAmount, previousAmount),
      },
    };
  }

  async evolution(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const constructionFees = await this.prisma.constructionFee.findMany({
      where: { propertyId, status: { not: PaymentStatus.CANCELED } },
      orderBy: [{ referenceMonth: 'asc' }, { createdAt: 'asc' }],
      select: {
        referenceMonth: true,
        amount: true,
        percentageReleased: true,
      },
    });

    return {
      data: constructionFees.map((fee) => ({
        ...fee,
        referenceMonth: this.formatDate(fee.referenceMonth),
      })),
    };
  }

  private calculateGrowth(
    lastAmount: Prisma.Decimal,
    previousAmount?: Prisma.Decimal,
  ): Prisma.Decimal {
    if (!previousAmount || previousAmount.isZero()) {
      return new Prisma.Decimal(0);
    }
    return lastAmount
      .minus(previousAmount)
      .dividedBy(previousAmount)
      .times(100)
      .toDecimalPlaces(2);
  }

  private buildListWhere(
    propertyId: string,
    query: ListConstructionFeesQueryDto,
  ): Prisma.ConstructionFeeWhereInput {
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
      ...(query.status && { status: query.status }),
      ...(Object.keys(referenceMonth).length > 0 && { referenceMonth }),
    };
  }

  private toUpdateData(
    dto: UpdateConstructionFeeDto,
  ): ConstructionFeeUpdateData {
    return {
      ...(dto.referenceMonth !== undefined && {
        referenceMonth: this.parseDate(dto.referenceMonth),
      }),
      ...(dto.percentageReleased !== undefined && {
        percentageReleased:
          dto.percentageReleased === null
            ? null
            : new Prisma.Decimal(dto.percentageReleased),
      }),
      ...(dto.amount !== undefined && {
        amount: new Prisma.Decimal(dto.amount),
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.paidDate !== undefined && {
        paidDate: dto.paidDate ? this.parseDate(dto.paidDate) : null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
    };
  }

  private validateFeeState(status: PaymentStatus, paidDate: Date | null): void {
    if (status === PaymentStatus.PAID && !paidDate) {
      throw new BadRequestException(
        'Taxas de obra pagas devem informar paidDate',
      );
    }
    if (status !== PaymentStatus.PAID && paidDate) {
      throw new BadRequestException(
        'Apenas taxas de obra pagas podem possuir paidDate',
      );
    }
  }

  private async ensureOwnedProperty(
    userId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
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

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
