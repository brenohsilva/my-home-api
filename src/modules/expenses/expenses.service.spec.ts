import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const expenseId = 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e';
  const expense = {
    id: expenseId,
    propertyId,
    description: 'Previsão de ITBI',
    category: ExpenseCategory.ITBI,
    status: PaymentStatus.PENDING,
    dueDate: new Date('2028-07-10T00:00:00.000Z'),
    paidDate: null,
    expectedAmount: new Prisma.Decimal(8500),
    paidAmount: null,
    notes: 'Valor estimado',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    expense: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: ExpensesService;

  beforeEach(() => {
    prisma = {
      property: { findFirst: jest.fn() },
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new ExpensesService(prisma as unknown as PrismaService);
  });

  it('creates an expense with Decimal values only for an owned property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.expense.create.mockResolvedValue(expense);

    await service.create(userId, propertyId, {
      description: ' Previsão de ITBI ',
      category: ExpenseCategory.ITBI,
      status: PaymentStatus.PENDING,
      dueDate: '2028-07-10',
      expectedAmount: 8500,
      notes: ' Valor estimado ',
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    expect(prisma.expense.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        propertyId,
        description: 'Previsão de ITBI',
        expectedAmount: new Prisma.Decimal(8500),
        dueDate: new Date('2028-07-10T00:00:00.000Z'),
        notes: 'Valor estimado',
      }),
    );
  });

  it('requires payment data when creating a paid expense', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.create(userId, propertyId, {
        description: 'ITBI',
        category: ExpenseCategory.ITBI,
        status: PaymentStatus.PAID,
        expectedAmount: 8500,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('applies ownership, pagination, category, status, and date filters', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([[expense], 1]);

    const result = await service.findAll(userId, propertyId, {
      page: 2,
      limit: 10,
      category: ExpenseCategory.ITBI,
      status: PaymentStatus.PENDING,
      startDate: '2028-01-01',
      endDate: '2028-12-31',
    });

    expect(prisma.expense.findMany).toHaveBeenCalledWith({
      where: {
        propertyId,
        category: ExpenseCategory.ITBI,
        status: PaymentStatus.PENDING,
        dueDate: {
          gte: new Date('2028-01-01T00:00:00.000Z'),
          lte: new Date('2028-12-31T23:59:59.999Z'),
        },
      },
      skip: 10,
      take: 10,
      orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('does not reveal an expense owned by another user', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('other-user', propertyId, expenseId),
    ).rejects.toThrow(new NotFoundException('Despesa não encontrada'));
    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: {
        id: expenseId,
        propertyId,
        property: { userId: 'other-user' },
      },
    });
  });

  it('marks an owned expense as paid', async () => {
    prisma.expense.findFirst.mockResolvedValue(expense);
    prisma.expense.update.mockResolvedValue({
      ...expense,
      status: PaymentStatus.PAID,
    });

    await service.pay(userId, propertyId, expenseId, {
      paidDate: '2028-07-10',
      paidAmount: 8300,
    });

    expect(prisma.expense.update).toHaveBeenCalledWith({
      where: { id: expenseId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: new Date('2028-07-10T00:00:00.000Z'),
        paidAmount: new Prisma.Decimal(8300),
      },
    });
  });

  it('rejects changing a paid expense to pending without clearing payment data', async () => {
    prisma.expense.findFirst.mockResolvedValue({
      ...expense,
      status: PaymentStatus.PAID,
      paidDate: new Date('2028-07-10T00:00:00.000Z'),
      paidAmount: new Prisma.Decimal(8300),
    });

    await expect(
      service.update(userId, propertyId, expenseId, {
        status: PaymentStatus.PENDING,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('returns totals and category grouping in the summary', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([
      { _sum: { expectedAmount: new Prisma.Decimal(35000) } },
      { _sum: { paidAmount: new Prisma.Decimal(5000) } },
      { _sum: { expectedAmount: new Prisma.Decimal(30000) } },
      [
        {
          category: ExpenseCategory.DOCUMENTATION,
          _sum: {
            expectedAmount: new Prisma.Decimal(12000),
            paidAmount: null,
          },
        },
        {
          category: ExpenseCategory.FURNITURE,
          _sum: {
            expectedAmount: new Prisma.Decimal(18000),
            paidAmount: new Prisma.Decimal(5000),
          },
        },
      ],
    ]);

    const result = await service.summary(userId, propertyId);

    expect(result.data).toEqual({
      expectedTotal: new Prisma.Decimal(35000),
      paidTotal: new Prisma.Decimal(5000),
      pendingTotal: new Prisma.Decimal(30000),
      byCategory: [
        {
          category: ExpenseCategory.DOCUMENTATION,
          expectedAmount: new Prisma.Decimal(12000),
          paidAmount: new Prisma.Decimal(0),
        },
        {
          category: ExpenseCategory.FURNITURE,
          expectedAmount: new Prisma.Decimal(18000),
          paidAmount: new Prisma.Decimal(5000),
        },
      ],
    });
  });
});
