import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConstructionStage, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialCalendarQueryDto } from './dto/financial-calendar-query.dto';
import {
  DashboardAlertSeverity,
  DashboardAlertType,
  FinancialCalendarSource,
} from './types/dashboard.types';
import { BuildFinancialSummaryUseCase } from './use-cases/build-financial-summary.use-case';
import { BuildKeyDeliveryForecastUseCase } from './use-cases/build-key-delivery-forecast.use-case';

export interface DashboardAlert {
  type: DashboardAlertType;
  severity: DashboardAlertSeverity;
  message: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buildFinancialSummary: BuildFinancialSummaryUseCase,
    private readonly buildKeyDeliveryForecast: BuildKeyDeliveryForecastUseCase,
  ) {}

  async getDashboard(userId: string, propertyId: string) {
    const property = await this.findOwnedProperty(userId, propertyId);
    const today = this.startOfToday();
    const [
      financialSummary,
      nextPayment,
      latestProgress,
      keyDeliveryForecast,
      overdueCounts,
    ] = await Promise.all([
      this.buildFinancialSummary.execute(propertyId),
      this.prisma.payment.findFirst({
        where: {
          propertyId,
          status: PaymentStatus.PENDING,
          dueDate: { gte: today },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          description: true,
          type: true,
          dueDate: true,
          expectedAmount: true,
        },
      }),
      this.prisma.constructionProgress.findFirst({
        where: { propertyId },
        orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
        select: {
          progressPercent: true,
          scheduledPercent: true,
        },
      }),
      this.buildKeyDeliveryForecast.execute(
        propertyId,
        property.expectedKeyDate,
      ),
      this.countOverdueItems(propertyId, today),
    ]);
    const currentPercent =
      latestProgress?.progressPercent ??
      property.progressPercent ??
      new Prisma.Decimal(0);
    const scheduledPercent = latestProgress?.scheduledPercent ?? null;
    const difference = scheduledPercent
      ? currentPercent.minus(scheduledPercent)
      : null;
    const alerts = this.buildAlerts({
      difference,
      overdueCount: overdueCounts,
      expectedKeyDate: property.expectedKeyDate,
      currentStage: property.currentStage,
      today,
    });

    return {
      data: {
        property: {
          ...property,
          expectedKeyDate: property.expectedKeyDate
            ? this.formatDate(property.expectedKeyDate)
            : null,
        },
        financialSummary,
        nextPayment: nextPayment
          ? {
              ...nextPayment,
              dueDate: this.formatDate(nextPayment.dueDate),
            }
          : null,
        construction: {
          currentPercent,
          scheduledPercent,
          difference,
        },
        keyDelivery: {
          estimatedMonthsRemaining:
            keyDeliveryForecast.estimatedMonthsRemaining,
          expectedExpenses: keyDeliveryForecast.expectedExpenses,
        },
        alerts,
      },
    };
  }

  async financialSummary(userId: string, propertyId: string) {
    await this.findOwnedProperty(userId, propertyId);
    return {
      data: await this.buildFinancialSummary.execute(propertyId),
    };
  }

  async financialCalendar(
    userId: string,
    propertyId: string,
    query: FinancialCalendarQueryDto,
  ) {
    await this.findOwnedProperty(userId, propertyId);
    const dateFilter = this.buildDateFilter(query);
    const [payments, expenses, constructionFees] =
      await this.prisma.$transaction([
        this.prisma.payment.findMany({
          where: {
            propertyId,
            status: { not: PaymentStatus.CANCELED },
            ...(dateFilter && { dueDate: dateFilter }),
          },
          select: {
            id: true,
            description: true,
            dueDate: true,
            expectedAmount: true,
            paidAmount: true,
            status: true,
          },
        }),
        this.prisma.expense.findMany({
          where: {
            propertyId,
            status: { not: PaymentStatus.CANCELED },
            dueDate: { not: null, ...(dateFilter ?? {}) },
          },
          select: {
            id: true,
            description: true,
            dueDate: true,
            expectedAmount: true,
            paidAmount: true,
            status: true,
          },
        }),
        this.prisma.constructionFee.findMany({
          where: {
            propertyId,
            status: { not: PaymentStatus.CANCELED },
            ...(dateFilter && { referenceMonth: dateFilter }),
          },
          select: {
            id: true,
            referenceMonth: true,
            amount: true,
            status: true,
          },
        }),
      ]);
    const today = this.startOfToday();
    const data = [
      ...payments.map((payment) => ({
        id: payment.id,
        source: FinancialCalendarSource.PAYMENT,
        description: payment.description,
        date: this.formatDate(payment.dueDate),
        amount:
          payment.status === PaymentStatus.PAID && payment.paidAmount !== null
            ? payment.paidAmount
            : payment.expectedAmount,
        status: this.resolveStatus(payment.status, payment.dueDate, today),
      })),
      ...expenses.map((expense) => ({
        id: expense.id,
        source: FinancialCalendarSource.EXPENSE,
        description: expense.description,
        date: this.formatDate(expense.dueDate as Date),
        amount:
          expense.status === PaymentStatus.PAID && expense.paidAmount !== null
            ? expense.paidAmount
            : expense.expectedAmount,
        status: this.resolveStatus(
          expense.status,
          expense.dueDate as Date,
          today,
        ),
      })),
      ...constructionFees.map((fee) => ({
        id: fee.id,
        source: FinancialCalendarSource.CONSTRUCTION_FEE,
        description: 'Taxa de obra',
        date: this.formatDate(fee.referenceMonth),
        amount: fee.amount,
        status: this.resolveStatus(fee.status, fee.referenceMonth, today),
      })),
    ].sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        first.source.localeCompare(second.source) ||
        first.id.localeCompare(second.id),
    );

    return { data };
  }

  async keyDeliveryForecast(userId: string, propertyId: string) {
    const property = await this.findOwnedProperty(userId, propertyId);
    return {
      data: await this.buildKeyDeliveryForecast.execute(
        propertyId,
        property.expectedKeyDate,
      ),
    };
  }

  private async findOwnedProperty(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, userId },
      select: {
        id: true,
        name: true,
        builderName: true,
        expectedKeyDate: true,
        currentStage: true,
        progressPercent: true,
      },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
    return property;
  }

  private async countOverdueItems(
    propertyId: string,
    today: Date,
  ): Promise<number> {
    const [payments, expenses, constructionFees] =
      await this.prisma.$transaction([
        this.prisma.payment.count({
          where: {
            propertyId,
            status: PaymentStatus.PENDING,
            dueDate: { lt: today },
          },
        }),
        this.prisma.expense.count({
          where: {
            propertyId,
            status: PaymentStatus.PENDING,
            dueDate: { lt: today },
          },
        }),
        this.prisma.constructionFee.count({
          where: {
            propertyId,
            status: PaymentStatus.PENDING,
            referenceMonth: { lt: today },
          },
        }),
      ]);
    return payments + expenses + constructionFees;
  }

  private buildAlerts(input: {
    difference: Prisma.Decimal | null;
    overdueCount: number;
    expectedKeyDate: Date | null;
    currentStage: ConstructionStage | null;
    today: Date;
  }): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];
    if (input.difference?.isNegative()) {
      alerts.push({
        type: DashboardAlertType.CONSTRUCTION_DELAY,
        severity: DashboardAlertSeverity.WARNING,
        message: `A obra está ${input.difference.abs().toString()} pontos percentuais abaixo do previsto.`,
      });
    }
    if (input.overdueCount > 0) {
      alerts.push({
        type: DashboardAlertType.OVERDUE_FINANCIAL_ITEM,
        severity: DashboardAlertSeverity.WARNING,
        message: `${input.overdueCount} compromisso(s) financeiro(s) estão em atraso.`,
      });
    }
    if (
      input.expectedKeyDate &&
      input.expectedKeyDate < input.today &&
      input.currentStage !== ConstructionStage.DELIVERED
    ) {
      alerts.push({
        type: DashboardAlertType.KEY_DELIVERY_OVERDUE,
        severity: DashboardAlertSeverity.CRITICAL,
        message: 'A data prevista para entrega das chaves já foi ultrapassada.',
      });
    }
    return alerts;
  }

  private buildDateFilter(
    query: FinancialCalendarQueryDto,
  ): Prisma.DateTimeFilter | undefined {
    if (
      query.startDate &&
      query.endDate &&
      this.parseDate(query.startDate) > this.parseDate(query.endDate)
    ) {
      throw new BadRequestException(
        'startDate não pode ser posterior a endDate',
      );
    }
    const filter: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: this.parseDate(query.startDate) }),
      ...(query.endDate && {
        lte: this.endOfDay(this.parseDate(query.endDate)),
      }),
    };
    return Object.keys(filter).length ? filter : undefined;
  }

  private resolveStatus(
    status: PaymentStatus,
    date: Date,
    today: Date,
  ): PaymentStatus {
    return status === PaymentStatus.PENDING && date < today
      ? PaymentStatus.OVERDUE
      : status;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
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
