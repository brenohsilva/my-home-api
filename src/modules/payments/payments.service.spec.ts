import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InstallmentFrequency } from './dto/generate-installments.dto';
import { PaymentSortBy, PaymentSortOrder } from './dto/list-payments-query.dto';
import { PaymentsService } from './payments.service';
import { GenerateInstallmentsUseCase } from './use-cases/generate-installments.use-case';

describe('PaymentsService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const paymentId = 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e';
  const payment = {
    id: paymentId,
    propertyId,
    description: 'Entrada inicial',
    type: PaymentType.DOWN_PAYMENT,
    status: PaymentStatus.PENDING,
    dueDate: new Date('2026-01-10T00:00:00.000Z'),
    paidDate: null,
    expectedAmount: new Prisma.Decimal(7000),
    paidAmount: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    payment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    prisma = {
      property: { findFirst: jest.fn() },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      new GenerateInstallmentsUseCase(),
    );
  });

  afterEach(() => jest.useRealTimers());

  it('creates a paid payment with Prisma Decimal values for an owned property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.payment.create.mockResolvedValue({
      ...payment,
      status: PaymentStatus.PAID,
    });

    await service.create(userId, propertyId, {
      description: ' Entrada inicial ',
      type: PaymentType.DOWN_PAYMENT,
      dueDate: '2026-01-10',
      expectedAmount: 7000,
      status: PaymentStatus.PAID,
      paidDate: '2026-01-10',
      paidAmount: 7000,
      notes: null,
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    expect(prisma.payment.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        description: 'Entrada inicial',
        status: PaymentStatus.PAID,
        expectedAmount: new Prisma.Decimal(7000),
        paidAmount: new Prisma.Decimal(7000),
      }),
    );
  });

  it('requires payment details when status is paid', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.create(userId, propertyId, {
        description: 'Entrada',
        type: PaymentType.DOWN_PAYMENT,
        dueDate: '2026-01-10',
        expectedAmount: 7000,
        status: PaymentStatus.PAID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('generates every installment inside one transaction', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.payment.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...payment, ...data }),
    );
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );

    const result = await service.generateInstallments(userId, propertyId, {
      description: 'Parcela da entrada',
      type: PaymentType.MONTHLY_INSTALLMENT,
      installmentCount: 3,
      installmentAmount: 700,
      firstDueDate: '2026-02-10',
      frequency: InstallmentFrequency.MONTHLY,
    });

    expect(prisma.payment.create).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.meta.count).toBe(3);
  });

  it('translates the OVERDUE list filter into pending past-due records', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([[payment], 1]);

    await service.findAll(userId, propertyId, {
      page: 1,
      limit: 20,
      status: PaymentStatus.OVERDUE,
      sortBy: PaymentSortBy.DUE_DATE,
      sortOrder: PaymentSortOrder.ASC,
    });

    expect(prisma.payment.findMany.mock.calls[0][0].where).toEqual({
      propertyId,
      status: PaymentStatus.PENDING,
      dueDate: { lt: new Date('2026-07-10T00:00:00.000Z') },
    });
  });

  it('rejects an inverted payment date range', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.findAll(userId, propertyId, {
        page: 1,
        limit: 20,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
        sortBy: PaymentSortBy.DUE_DATE,
        sortOrder: PaymentSortOrder.ASC,
      }),
    ).rejects.toThrow(
      new BadRequestException('startDate não pode ser posterior a endDate'),
    );
  });

  it('scopes an individual lookup through property ownership', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('other-user', propertyId, paymentId),
    ).rejects.toThrow(new NotFoundException('Pagamento não encontrado'));
    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        propertyId,
        property: { userId: 'other-user' },
      },
    });
  });

  it('marks a payment as paid and reopens it clearing payment data', async () => {
    prisma.payment.findFirst.mockResolvedValue(payment);
    prisma.payment.update.mockResolvedValue(payment);

    await service.pay(userId, propertyId, paymentId, {
      paidDate: '2026-07-10',
      paidAmount: 700,
    });
    await service.reopen(userId, propertyId, paymentId);

    expect(prisma.payment.update).toHaveBeenNthCalledWith(1, {
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: new Date('2026-07-10T00:00:00.000Z'),
        paidAmount: new Prisma.Decimal(700),
      },
    });
    expect(prisma.payment.update).toHaveBeenNthCalledWith(2, {
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        paidDate: null,
        paidAmount: null,
      },
    });
  });

  it('does not partially delete a batch containing unknown payments', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.payment.findMany.mockResolvedValue([{ id: paymentId }]);

    await expect(
      service.removeMany(userId, propertyId, {
        paymentIds: [paymentId, '42683d0b-051f-42af-9f99-ec387d221f50'],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('returns payment totals and counts in the summary', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([
      { _sum: { expectedAmount: new Prisma.Decimal(42000) } },
      { _sum: { paidAmount: new Prisma.Decimal(14000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(28000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(700) } },
      20,
      40,
    ]);

    const result = await service.summary(userId, propertyId);

    expect(result.data).toEqual({
      expectedTotal: new Prisma.Decimal(42000),
      paidTotal: new Prisma.Decimal(14000),
      pendingTotal: new Prisma.Decimal(28000),
      overdueTotal: new Prisma.Decimal(700),
      paidCount: 20,
      pendingCount: 40,
    });
  });
});
