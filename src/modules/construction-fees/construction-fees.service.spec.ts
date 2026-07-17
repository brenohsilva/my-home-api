import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConstructionFeesService } from './construction-fees.service';

describe('ConstructionFeesService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const constructionFeeId = 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e';
  const constructionFee = {
    id: constructionFeeId,
    propertyId,
    referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
    percentageReleased: new Prisma.Decimal(35),
    amount: new Prisma.Decimal(850),
    status: PaymentStatus.PENDING,
    paidDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    constructionFee: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: ConstructionFeesService;

  beforeEach(() => {
    prisma = {
      property: { findFirst: jest.fn() },
      constructionFee: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new ConstructionFeesService(prisma as unknown as PrismaService);
  });

  it('creates a fee with Decimal values only for an owned property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.constructionFee.create.mockResolvedValue(constructionFee);

    await service.create(userId, propertyId, {
      referenceMonth: '2026-07-01',
      percentageReleased: 35,
      amount: 850,
      status: PaymentStatus.PENDING,
      notes: ' Taxa de julho ',
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    expect(prisma.constructionFee.create).toHaveBeenCalledWith({
      data: {
        propertyId,
        referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
        percentageReleased: new Prisma.Decimal(35),
        amount: new Prisma.Decimal(850),
        status: PaymentStatus.PENDING,
        paidDate: null,
        notes: 'Taxa de julho',
      },
    });
  });

  it('requires paidDate when creating a paid fee', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.create(userId, propertyId, {
        referenceMonth: '2026-07-01',
        amount: 850,
        status: PaymentStatus.PAID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.constructionFee.create).not.toHaveBeenCalled();
  });

  it('applies ownership, pagination, status, and date filters', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([[constructionFee], 1]);

    const result = await service.findAll(userId, propertyId, {
      page: 2,
      limit: 10,
      status: PaymentStatus.PENDING,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(prisma.constructionFee.findMany).toHaveBeenCalledWith({
      where: {
        propertyId,
        status: PaymentStatus.PENDING,
        referenceMonth: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T23:59:59.999Z'),
        },
      },
      skip: 10,
      take: 10,
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('rejects an inverted date range', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.findAll(userId, propertyId, {
        page: 1,
        limit: 20,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not reveal a fee owned by another user', async () => {
    prisma.constructionFee.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('other-user', propertyId, constructionFeeId),
    ).rejects.toThrow(new NotFoundException('Taxa de obra não encontrada'));
    expect(prisma.constructionFee.findFirst).toHaveBeenCalledWith({
      where: {
        id: constructionFeeId,
        propertyId,
        property: { userId: 'other-user' },
      },
    });
  });

  it('marks an owned fee as paid', async () => {
    prisma.constructionFee.findFirst.mockResolvedValue(constructionFee);
    prisma.constructionFee.update.mockResolvedValue({
      ...constructionFee,
      status: PaymentStatus.PAID,
    });

    await service.pay(userId, propertyId, constructionFeeId, {
      paidDate: '2026-07-15',
    });

    expect(prisma.constructionFee.update).toHaveBeenCalledWith({
      where: { id: constructionFeeId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: new Date('2026-07-15T00:00:00.000Z'),
      },
    });
  });

  it('rejects changing a paid fee to pending without clearing paidDate', async () => {
    prisma.constructionFee.findFirst.mockResolvedValue({
      ...constructionFee,
      status: PaymentStatus.PAID,
      paidDate: new Date('2026-07-15T00:00:00.000Z'),
    });

    await expect(
      service.update(userId, propertyId, constructionFeeId, {
        status: PaymentStatus.PENDING,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.constructionFee.update).not.toHaveBeenCalled();
  });

  it('returns totals and growth indicators in the summary', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.$transaction.mockResolvedValue([
      { _sum: { amount: new Prisma.Decimal(7300) } },
      { _sum: { amount: new Prisma.Decimal(850) } },
      {
        _avg: { amount: new Prisma.Decimal('608.33') },
        _max: { amount: new Prisma.Decimal(850) },
      },
      [
        { amount: new Prisma.Decimal(850) },
        { amount: new Prisma.Decimal(755) },
      ],
    ]);

    const result = await service.summary(userId, propertyId);

    expect(result.data).toEqual({
      totalPaid: new Prisma.Decimal(7300),
      totalPending: new Prisma.Decimal(850),
      averageAmount: new Prisma.Decimal('608.33'),
      highestAmount: new Prisma.Decimal(850),
      lastAmount: new Prisma.Decimal(850),
      growthPercentage: new Prisma.Decimal('12.58'),
    });
  });

  it('returns the evolution chronologically and without canceled fees', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.constructionFee.findMany.mockResolvedValue([
      {
        referenceMonth: new Date('2026-05-01T00:00:00.000Z'),
        amount: new Prisma.Decimal(620),
        percentageReleased: new Prisma.Decimal(25),
      },
      {
        referenceMonth: new Date('2026-06-01T00:00:00.000Z'),
        amount: new Prisma.Decimal(755),
        percentageReleased: new Prisma.Decimal(30),
      },
    ]);

    const result = await service.evolution(userId, propertyId);

    expect(prisma.constructionFee.findMany).toHaveBeenCalledWith({
      where: { propertyId, status: { not: PaymentStatus.CANCELED } },
      orderBy: [{ referenceMonth: 'asc' }, { createdAt: 'asc' }],
      select: {
        referenceMonth: true,
        amount: true,
        percentageReleased: true,
      },
    });
    expect(result.data[0]).toEqual({
      referenceMonth: '2026-05-01',
      amount: new Prisma.Decimal(620),
      percentageReleased: new Prisma.Decimal(25),
    });
  });
});
