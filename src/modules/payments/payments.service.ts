import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { DeletePaymentsDto } from './dto/delete-payments.dto';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { GenerateIntermediateInstallmentsDto } from './dto/generate-intermediate-installments.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PayPaymentDto } from './dto/pay-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpcomingPaymentsQueryDto } from './dto/upcoming-payments-query.dto';
import { GenerateInstallmentsUseCase } from './use-cases/generate-installments.use-case';

interface PaymentUpdateData {
  description?: string;
  type?: Payment['type'];
  status?: PaymentStatus;
  dueDate?: Date;
  expectedAmount?: Prisma.Decimal;
  paidDate?: Date | null;
  paidAmount?: Prisma.Decimal | null;
  notes?: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generateInstallmentsUseCase: GenerateInstallmentsUseCase,
  ) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    await this.ensureOwnedProperty(userId, propertyId);
    const status = dto.status ?? PaymentStatus.PENDING;
    const paidDate = dto.paidDate ? this.parseDate(dto.paidDate) : null;
    const paidAmount =
      dto.paidAmount !== undefined && dto.paidAmount !== null
        ? new Prisma.Decimal(dto.paidAmount)
        : null;
    this.validatePaymentState(status, paidDate, paidAmount);

    return this.prisma.payment.create({
      data: {
        propertyId,
        description: dto.description.trim(),
        type: dto.type,
        status,
        dueDate: this.parseDate(dto.dueDate),
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
        paidDate,
        paidAmount,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async generateInstallments(
    userId: string,
    propertyId: string,
    dto: GenerateInstallmentsDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    return this.createGeneratedPayments(
      this.generateInstallmentsUseCase.execute({
        propertyId,
        description: dto.description,
        type: dto.type,
        installmentCount: dto.installmentCount,
        installmentAmount: dto.installmentAmount,
        firstDueDate: dto.firstDueDate,
        frequency: dto.frequency,
      }),
    );
  }

  async generateIntermediateInstallments(
    userId: string,
    propertyId: string,
    dto: GenerateIntermediateInstallmentsDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    return this.createGeneratedPayments(
      this.generateInstallmentsUseCase.execute({
        propertyId,
        description: dto.description,
        type: dto.type,
        installmentCount: dto.installmentCount,
        installmentAmount: dto.amount,
        firstDueDate: dto.firstDueDate,
        frequency: dto.frequency,
      }),
    );
  }

  async findAll(
    userId: string,
    propertyId: string,
    query: ListPaymentsQueryDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    const where = this.buildListWhere(propertyId, query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.payment.count({ where }),
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
    paymentId: string,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, propertyId, property: { userId } },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    return payment;
  }

  async update(
    userId: string,
    propertyId: string,
    paymentId: string,
    dto: UpdatePaymentDto,
  ): Promise<Payment> {
    const current = await this.findOne(userId, propertyId, paymentId);
    const data = this.toUpdateData(dto);
    const resultingStatus = dto.status ?? current.status;
    const resultingPaidDate =
      data.paidDate !== undefined ? data.paidDate : current.paidDate;
    const resultingPaidAmount =
      data.paidAmount !== undefined ? data.paidAmount : current.paidAmount;
    this.validatePaymentState(
      resultingStatus,
      resultingPaidDate,
      resultingPaidAmount,
    );

    return this.prisma.payment.update({ where: { id: paymentId }, data });
  }

  async pay(
    userId: string,
    propertyId: string,
    paymentId: string,
    dto: PayPaymentDto,
  ): Promise<Payment> {
    await this.findOne(userId, propertyId, paymentId);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: this.parseDate(dto.paidDate),
        paidAmount: new Prisma.Decimal(dto.paidAmount),
      },
    });
  }

  async reopen(
    userId: string,
    propertyId: string,
    paymentId: string,
  ): Promise<Payment> {
    await this.findOne(userId, propertyId, paymentId);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        paidDate: null,
        paidAmount: null,
      },
    });
  }

  async remove(
    userId: string,
    propertyId: string,
    paymentId: string,
  ): Promise<void> {
    await this.findOne(userId, propertyId, paymentId);
    await this.prisma.payment.delete({ where: { id: paymentId } });
  }

  async removeMany(
    userId: string,
    propertyId: string,
    dto: DeletePaymentsDto,
  ): Promise<void> {
    await this.ensureOwnedProperty(userId, propertyId);
    const paymentIds = [...new Set(dto.paymentIds)];
    const ownedPayments = await this.prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        propertyId,
        property: { userId },
      },
      select: { id: true },
    });
    if (ownedPayments.length !== paymentIds.length) {
      throw new NotFoundException(
        'Um ou mais pagamentos não foram encontrados',
      );
    }
    await this.prisma.payment.deleteMany({
      where: { id: { in: paymentIds }, propertyId },
    });
  }

  async upcoming(
    userId: string,
    propertyId: string,
    query: UpcomingPaymentsQueryDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    const startDate = this.startOfToday();
    const endDate = this.endOfDay(this.addDays(startDate, query.days));
    const data = await this.prisma.payment.findMany({
      where: {
        propertyId,
        status: PaymentStatus.PENDING,
        dueDate: { gte: startDate, lte: endDate },
      },
      orderBy: { dueDate: 'asc' },
      take: query.limit,
    });
    return { data };
  }

  async overdue(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const data = await this.prisma.payment.findMany({
      where: {
        propertyId,
        status: PaymentStatus.PENDING,
        dueDate: { lt: this.startOfToday() },
      },
      orderBy: { dueDate: 'asc' },
    });
    return { data };
  }

  async summary(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const today = this.startOfToday();
    const [expected, paid, pending, overdue, paidCount, pendingCount] =
      await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          where: { propertyId, status: { not: PaymentStatus.CANCELED } },
          _sum: { expectedAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: { propertyId, status: PaymentStatus.PAID },
          _sum: { paidAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: { propertyId, status: PaymentStatus.PENDING },
          _sum: { expectedAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            propertyId,
            status: PaymentStatus.PENDING,
            dueDate: { lt: today },
          },
          _sum: { expectedAmount: true },
        }),
        this.prisma.payment.count({
          where: { propertyId, status: PaymentStatus.PAID },
        }),
        this.prisma.payment.count({
          where: { propertyId, status: PaymentStatus.PENDING },
        }),
      ]);

    return {
      data: {
        expectedTotal: expected._sum.expectedAmount ?? new Prisma.Decimal(0),
        paidTotal: paid._sum.paidAmount ?? new Prisma.Decimal(0),
        pendingTotal: pending._sum.expectedAmount ?? new Prisma.Decimal(0),
        overdueTotal: overdue._sum.expectedAmount ?? new Prisma.Decimal(0),
        paidCount,
        pendingCount,
      },
    };
  }

  private async createGeneratedPayments(
    records: Prisma.PaymentUncheckedCreateInput[],
  ) {
    const data = await this.prisma.$transaction(
      records.map((record) => this.prisma.payment.create({ data: record })),
    );
    return { data, meta: { count: data.length } };
  }

  private buildListWhere(
    propertyId: string,
    query: ListPaymentsQueryDto,
  ): Prisma.PaymentWhereInput {
    if (
      query.startDate &&
      query.endDate &&
      this.parseDate(query.startDate) > this.parseDate(query.endDate)
    ) {
      throw new BadRequestException(
        'startDate não pode ser posterior a endDate',
      );
    }
    const dueDate: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: this.parseDate(query.startDate) }),
      ...(query.endDate && {
        lte: this.endOfDay(this.parseDate(query.endDate)),
      }),
    };
    const overdueFilter =
      query.status === PaymentStatus.OVERDUE
        ? {
            status: PaymentStatus.PENDING,
            dueDate: { ...dueDate, lt: this.startOfToday() },
          }
        : {
            ...(query.status && { status: query.status }),
            ...(Object.keys(dueDate).length > 0 && { dueDate }),
          };

    return {
      propertyId,
      ...overdueFilter,
      ...(query.type && { type: query.type }),
    };
  }

  private toUpdateData(dto: UpdatePaymentDto): PaymentUpdateData {
    return {
      ...(dto.description !== undefined && {
        description: dto.description.trim(),
      }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.dueDate !== undefined && {
        dueDate: this.parseDate(dto.dueDate),
      }),
      ...(dto.expectedAmount !== undefined && {
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
      }),
      ...(dto.paidDate !== undefined && {
        paidDate: dto.paidDate ? this.parseDate(dto.paidDate) : null,
      }),
      ...(dto.paidAmount !== undefined && {
        paidAmount:
          dto.paidAmount === null ? null : new Prisma.Decimal(dto.paidAmount),
      }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
    };
  }

  private validatePaymentState(
    status: PaymentStatus,
    paidDate: Date | null,
    paidAmount: Prisma.Decimal | null,
  ): void {
    if (status === PaymentStatus.OVERDUE) {
      throw new BadRequestException(
        'O status de atraso é calculado automaticamente pela API',
      );
    }
    if (status === PaymentStatus.PAID && (!paidDate || paidAmount === null)) {
      throw new BadRequestException(
        'Pagamentos quitados devem informar paidDate e paidAmount',
      );
    }
    if (
      status !== PaymentStatus.PAID &&
      (paidDate !== null || paidAmount !== null)
    ) {
      throw new BadRequestException(
        'Apenas pagamentos quitados podem possuir dados de pagamento',
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

  private startOfToday(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
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

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
