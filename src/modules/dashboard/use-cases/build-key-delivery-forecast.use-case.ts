import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConstructionFeeEstimationMethod } from '../types/dashboard.types';

@Injectable()
export class BuildKeyDeliveryForecastUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(propertyId: string, expectedKeyDate: Date | null) {
    const zero = new Prisma.Decimal(0);
    const monthsRemaining = this.monthsUntil(expectedKeyDate);
    const pendingStatuses = {
      in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
    };
    const keyDateFilter = expectedKeyDate
      ? { lte: this.endOfDay(expectedKeyDate) }
      : undefined;
    const [payments, expenses, adjustments, recentConstructionFees] =
      await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          where: {
            propertyId,
            status: pendingStatuses,
            ...(keyDateFilter && { dueDate: keyDateFilter }),
          },
          _sum: { expectedAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            propertyId,
            status: pendingStatuses,
            ...(keyDateFilter && {
              OR: [{ dueDate: keyDateFilter }, { dueDate: null }],
            }),
          },
          _sum: { expectedAmount: true },
        }),
        this.prisma.adjustmentIndex.aggregate({
          where: {
            propertyId,
            ...(keyDateFilter && { referenceMonth: keyDateFilter }),
          },
          _sum: { amountImpact: true },
        }),
        this.prisma.constructionFee.findMany({
          where: {
            propertyId,
            status: { not: PaymentStatus.CANCELED },
            referenceMonth: { lte: this.endOfDay(new Date()) },
          },
          orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
          select: { amount: true },
          take: 3,
        }),
      ]);
    const monthlyAverage = recentConstructionFees.length
      ? recentConstructionFees
          .reduce((total, fee) => total.plus(fee.amount), zero)
          .div(recentConstructionFees.length)
          .toDecimalPlaces(2)
      : zero;
    const expectedConstructionFees = monthlyAverage
      .times(monthsRemaining ?? 0)
      .toDecimalPlaces(2);
    const pendingPayments = payments._sum.expectedAmount ?? zero;
    const expectedExpenses = expenses._sum.expectedAmount ?? zero;
    const adjustmentImpact = adjustments._sum.amountImpact ?? zero;

    return {
      expectedKeyDate: expectedKeyDate
        ? this.formatDate(expectedKeyDate)
        : null,
      pendingPayments,
      expectedConstructionFees,
      expectedExpenses,
      adjustmentImpact,
      estimatedTotalUntilKeyDelivery: pendingPayments
        .plus(expectedConstructionFees)
        .plus(expectedExpenses)
        .plus(adjustmentImpact),
      isEstimate: true,
      estimationMethod: ConstructionFeeEstimationMethod.AVERAGE_LAST_3_RECORDS,
      constructionFeeMonthlyAverage: monthlyAverage,
      estimatedMonthsRemaining: monthsRemaining,
      estimationMessage:
        'A previsão da taxa de obra utiliza a média dos três últimos registros e pode variar até a entrega das chaves.',
    };
  }

  private monthsUntil(targetDate: Date | null): number | null {
    if (!targetDate) return null;
    const today = new Date();
    const months =
      (targetDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
      targetDate.getUTCMonth() -
      today.getUTCMonth();
    return Math.max(0, months);
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
