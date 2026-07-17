import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConstructionFeeEstimationMethod } from '../types/dashboard.types';
import { BuildKeyDeliveryForecastUseCase } from './build-key-delivery-forecast.use-case';

describe('BuildKeyDeliveryForecastUseCase', () => {
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  let prisma: {
    payment: { aggregate: jest.Mock };
    expense: { aggregate: jest.Mock };
    adjustmentIndex: { aggregate: jest.Mock };
    constructionFee: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let useCase: BuildKeyDeliveryForecastUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
    prisma = {
      payment: { aggregate: jest.fn() },
      expense: { aggregate: jest.fn() },
      adjustmentIndex: { aggregate: jest.fn() },
      constructionFee: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    useCase = new BuildKeyDeliveryForecastUseCase(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('projects construction fees using the last three records average', async () => {
    prisma.$transaction.mockResolvedValue([
      { _sum: { expectedAmount: new Prisma.Decimal(25200) } },
      { _sum: { expectedAmount: new Prisma.Decimal(35000) } },
      { _sum: { amountImpact: new Prisma.Decimal(3000) } },
      [
        { amount: new Prisma.Decimal(650) },
        { amount: new Prisma.Decimal(600) },
        { amount: new Prisma.Decimal(550) },
      ],
    ]);

    const result = await useCase.execute(
      propertyId,
      new Date('2028-06-30T00:00:00.000Z'),
    );

    expect(result).toEqual({
      expectedKeyDate: '2028-06-30',
      pendingPayments: new Prisma.Decimal(25200),
      expectedConstructionFees: new Prisma.Decimal(13800),
      expectedExpenses: new Prisma.Decimal(35000),
      adjustmentImpact: new Prisma.Decimal(3000),
      estimatedTotalUntilKeyDelivery: new Prisma.Decimal(77000),
      isEstimate: true,
      estimationMethod: ConstructionFeeEstimationMethod.AVERAGE_LAST_3_RECORDS,
      constructionFeeMonthlyAverage: new Prisma.Decimal(600),
      estimatedMonthsRemaining: 23,
      estimationMessage:
        'A previsão da taxa de obra utiliza a média dos três últimos registros e pode variar até a entrega das chaves.',
    });
  });

  it('does not project construction fees without an expected key date', async () => {
    prisma.$transaction.mockResolvedValue([
      { _sum: {} },
      { _sum: {} },
      { _sum: {} },
      [{ amount: new Prisma.Decimal(850) }],
    ]);

    const result = await useCase.execute(propertyId, null);

    expect(result.expectedKeyDate).toBeNull();
    expect(result.estimatedMonthsRemaining).toBeNull();
    expect(result.expectedConstructionFees).toEqual(new Prisma.Decimal(0));
  });
});
