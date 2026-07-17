import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ConstructionStage,
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import {
  DashboardAlertSeverity,
  DashboardAlertType,
  FinancialCalendarSource,
} from './types/dashboard.types';
import { BuildFinancialSummaryUseCase } from './use-cases/build-financial-summary.use-case';
import { BuildKeyDeliveryForecastUseCase } from './use-cases/build-key-delivery-forecast.use-case';

describe('DashboardService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const property = {
    id: propertyId,
    name: 'Residencial Aurora',
    builderName: 'Construtora Exemplo',
    expectedKeyDate: new Date('2028-06-30T00:00:00.000Z'),
    currentStage: ConstructionStage.STRUCTURE,
    progressPercent: new Prisma.Decimal(35),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    payment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    expense: { findMany: jest.Mock; count: jest.Mock };
    constructionFee: { findMany: jest.Mock; count: jest.Mock };
    constructionProgress: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let financialSummary: { execute: jest.Mock };
  let keyDeliveryForecast: { execute: jest.Mock };
  let service: DashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
    prisma = {
      property: { findFirst: jest.fn() },
      payment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      expense: { findMany: jest.fn(), count: jest.fn() },
      constructionFee: { findMany: jest.fn(), count: jest.fn() },
      constructionProgress: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    financialSummary = { execute: jest.fn() };
    keyDeliveryForecast = { execute: jest.fn() };
    service = new DashboardService(
      prisma as unknown as PrismaService,
      financialSummary as unknown as BuildFinancialSummaryUseCase,
      keyDeliveryForecast as unknown as BuildKeyDeliveryForecastUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('rejects dashboard access for a property owned by another user', async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(
      service.getDashboard('other-user', propertyId),
    ).rejects.toThrow(new NotFoundException('Imóvel não encontrado'));
    expect(financialSummary.execute).not.toHaveBeenCalled();
  });

  it('returns the consolidated dashboard and generated alerts', async () => {
    prisma.property.findFirst.mockResolvedValue(property);
    financialSummary.execute.mockResolvedValue({
      totalPaid: new Prisma.Decimal(28700),
      totalPending: new Prisma.Decimal(53200),
      totalExpected: new Prisma.Decimal(81900),
      constructionFeePaid: new Prisma.Decimal(7300),
      adjustmentImpact: new Prisma.Decimal(2400),
    });
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-id',
      description: 'Parcela da entrada 15/36',
      type: PaymentType.MONTHLY_INSTALLMENT,
      dueDate: new Date('2026-08-10T00:00:00.000Z'),
      expectedAmount: new Prisma.Decimal(700),
    });
    prisma.constructionProgress.findFirst.mockResolvedValue({
      progressPercent: new Prisma.Decimal(35),
      scheduledPercent: new Prisma.Decimal(42),
    });
    keyDeliveryForecast.execute.mockResolvedValue({
      estimatedMonthsRemaining: 23,
      expectedExpenses: new Prisma.Decimal(35000),
    });
    prisma.$transaction.mockResolvedValue([1, 1, 0]);

    const result = await service.getDashboard(userId, propertyId);

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
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
    expect(result.data.property.expectedKeyDate).toBe('2028-06-30');
    expect(result.data.nextPayment?.dueDate).toBe('2026-08-10');
    expect(result.data.construction).toEqual({
      currentPercent: new Prisma.Decimal(35),
      scheduledPercent: new Prisma.Decimal(42),
      difference: new Prisma.Decimal(-7),
    });
    expect(result.data.alerts).toEqual([
      {
        type: DashboardAlertType.CONSTRUCTION_DELAY,
        severity: DashboardAlertSeverity.WARNING,
        message: 'A obra está 7 pontos percentuais abaixo do previsto.',
      },
      {
        type: DashboardAlertType.OVERDUE_FINANCIAL_ITEM,
        severity: DashboardAlertSeverity.WARNING,
        message: '2 compromisso(s) financeiro(s) estão em atraso.',
      },
    ]);
  });

  it('returns a sorted financial calendar with calculated overdue status', async () => {
    prisma.property.findFirst.mockResolvedValue(property);
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'payment-id',
          description: 'Parcela da entrada',
          dueDate: new Date('2026-07-10T00:00:00.000Z'),
          expectedAmount: new Prisma.Decimal(700),
          paidAmount: null,
          status: PaymentStatus.PENDING,
        },
      ],
      [
        {
          id: 'expense-id',
          description: 'ITBI',
          dueDate: new Date('2026-08-20T00:00:00.000Z'),
          expectedAmount: new Prisma.Decimal(8500),
          paidAmount: new Prisma.Decimal(8300),
          status: PaymentStatus.PAID,
        },
      ],
      [
        {
          id: 'fee-id',
          referenceMonth: new Date('2026-08-01T00:00:00.000Z'),
          amount: new Prisma.Decimal(900),
          status: PaymentStatus.PENDING,
        },
      ],
    ]);

    const result = await service.financialCalendar(userId, propertyId, {
      startDate: '2026-07-01',
      endDate: '2026-08-31',
    });

    expect(result.data).toEqual([
      {
        id: 'payment-id',
        source: FinancialCalendarSource.PAYMENT,
        description: 'Parcela da entrada',
        date: '2026-07-10',
        amount: new Prisma.Decimal(700),
        status: PaymentStatus.OVERDUE,
      },
      {
        id: 'fee-id',
        source: FinancialCalendarSource.CONSTRUCTION_FEE,
        description: 'Taxa de obra',
        date: '2026-08-01',
        amount: new Prisma.Decimal(900),
        status: PaymentStatus.PENDING,
      },
      {
        id: 'expense-id',
        source: FinancialCalendarSource.EXPENSE,
        description: 'ITBI',
        date: '2026-08-20',
        amount: new Prisma.Decimal(8300),
        status: PaymentStatus.PAID,
      },
    ]);
  });

  it('rejects an inverted financial calendar date range', async () => {
    prisma.property.findFirst.mockResolvedValue(property);

    await expect(
      service.financialCalendar(userId, propertyId, {
        startDate: '2026-08-31',
        endDate: '2026-07-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the forecast only after checking property ownership', async () => {
    prisma.property.findFirst.mockResolvedValue(property);
    keyDeliveryForecast.execute.mockResolvedValue({
      estimatedTotalUntilKeyDelivery: new Prisma.Decimal(77200),
    });

    const result = await service.keyDeliveryForecast(userId, propertyId);

    expect(keyDeliveryForecast.execute).toHaveBeenCalledWith(
      propertyId,
      property.expectedKeyDate,
    );
    expect(result.data.estimatedTotalUntilKeyDelivery).toEqual(
      new Prisma.Decimal(77200),
    );
  });
});
