import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BuildFinancialSummaryUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(propertyId: string) {
    const activeStatuses = { not: PaymentStatus.CANCELED };
    const pendingStatuses = {
      in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
    };
    const [
      paymentExpected,
      paymentPaid,
      paymentPending,
      expenseExpected,
      expensePaid,
      expensePending,
      constructionFeeExpected,
      constructionFeePaid,
      constructionFeePending,
      adjustments,
    ] = await this.prisma.$transaction([
      this.prisma.payment.aggregate({
        where: { propertyId, status: activeStatuses },
        _sum: { expectedAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { propertyId, status: PaymentStatus.PAID },
        _sum: { paidAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { propertyId, status: pendingStatuses },
        _sum: { expectedAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { propertyId, status: activeStatuses },
        _sum: { expectedAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { propertyId, status: PaymentStatus.PAID },
        _sum: { paidAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { propertyId, status: pendingStatuses },
        _sum: { expectedAmount: true },
      }),
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: activeStatuses },
        _sum: { amount: true },
      }),
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.constructionFee.aggregate({
        where: { propertyId, status: pendingStatuses },
        _sum: { amount: true },
      }),
      this.prisma.adjustmentIndex.aggregate({
        where: { propertyId },
        _sum: { amountImpact: true },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const paymentPaidTotal = paymentPaid._sum.paidAmount ?? zero;
    const expensePaidTotal = expensePaid._sum.paidAmount ?? zero;
    const constructionFeePaidTotal = constructionFeePaid._sum.amount ?? zero;
    const totalPaid = paymentPaidTotal
      .plus(expensePaidTotal)
      .plus(constructionFeePaidTotal);
    const totalPending = (paymentPending._sum.expectedAmount ?? zero)
      .plus(expensePending._sum.expectedAmount ?? zero)
      .plus(constructionFeePending._sum.amount ?? zero);
    const totalExpected = (paymentExpected._sum.expectedAmount ?? zero)
      .plus(expenseExpected._sum.expectedAmount ?? zero)
      .plus(constructionFeeExpected._sum.amount ?? zero);

    return {
      totalPaid,
      totalPending,
      totalExpected,
      constructionFeePaid: constructionFeePaidTotal,
      adjustmentImpact: adjustments._sum.amountImpact ?? zero,
    };
  }
}
