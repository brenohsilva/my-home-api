import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BuildFinancialSummaryUseCase } from './build-financial-summary.use-case';

describe('BuildFinancialSummaryUseCase', () => {
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  let prisma: {
    payment: { aggregate: jest.Mock };
    expense: { aggregate: jest.Mock };
    constructionFee: { aggregate: jest.Mock };
    adjustmentIndex: { aggregate: jest.Mock };
    $transaction: jest.Mock;
  };
  let useCase: BuildFinancialSummaryUseCase;

  beforeEach(() => {
    prisma = {
      payment: { aggregate: jest.fn() },
      expense: { aggregate: jest.fn() },
      constructionFee: { aggregate: jest.fn() },
      adjustmentIndex: { aggregate: jest.fn() },
      $transaction: jest.fn(),
    };
    useCase = new BuildFinancialSummaryUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('aggregates payments, expenses, construction fees, and adjustments', async () => {
    prisma.$transaction.mockResolvedValue([
      { _sum: { expectedAmount: new Prisma.Decimal(42000) } },
      { _sum: { paidAmount: new Prisma.Decimal(14000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(28000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(35000) } },
      { _sum: { paidAmount: new Prisma.Decimal(5000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(25000) } },
      { _sum: { amount: new Prisma.Decimal(4900) } },
      { _sum: { amount: new Prisma.Decimal(7300) } },
      { _sum: { amount: new Prisma.Decimal(200) } },
      { _sum: { amountImpact: new Prisma.Decimal(2400) } },
    ]);

    const result = await useCase.execute(propertyId);

    expect(result).toEqual({
      totalPaid: new Prisma.Decimal(26300),
      totalPending: new Prisma.Decimal(53200),
      totalExpected: new Prisma.Decimal(81900),
      constructionFeePaid: new Prisma.Decimal(7300),
      adjustmentImpact: new Prisma.Decimal(2400),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns Decimal zero when no financial records exist', async () => {
    prisma.$transaction.mockResolvedValue(
      Array.from({ length: 10 }, () => ({ _sum: {} })),
    );

    const result = await useCase.execute(propertyId);

    expect(result).toEqual({
      totalPaid: new Prisma.Decimal(0),
      totalPending: new Prisma.Decimal(0),
      totalExpected: new Prisma.Decimal(0),
      constructionFeePaid: new Prisma.Decimal(0),
      adjustmentImpact: new Prisma.Decimal(0),
    });
  });
});
