import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdjustmentIndexType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustmentIndexesService } from './adjustment-indexes.service';

describe('AdjustmentIndexesService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const adjustmentIndexId = 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e';
  const adjustmentIndex = {
    id: adjustmentIndexId,
    propertyId,
    referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
    type: AdjustmentIndexType.INCC,
    percentage: new Prisma.Decimal('0.48'),
    amountImpact: new Prisma.Decimal(125),
    createdAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    adjustmentIndex: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: AdjustmentIndexesService;

  beforeEach(() => {
    prisma = {
      property: { findFirst: jest.fn() },
      adjustmentIndex: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new AdjustmentIndexesService(prisma as unknown as PrismaService);
  });

  it('creates an index with Decimal values only for an owned property', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });
    prisma.adjustmentIndex.create.mockResolvedValue(adjustmentIndex);

    await service.create(userId, propertyId, {
      referenceMonth: '2026-07-01',
      type: AdjustmentIndexType.INCC,
      percentage: 0.48,
      amountImpact: 125,
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true, purchaseValue: true },
    });
    expect(prisma.adjustmentIndex.create).toHaveBeenCalledWith({
      data: {
        propertyId,
        referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
        type: AdjustmentIndexType.INCC,
        percentage: new Prisma.Decimal('0.48'),
        amountImpact: new Prisma.Decimal(125),
      },
    });
  });

  it('returns conflict when the type already exists for the month', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });
    prisma.adjustmentIndex.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(userId, propertyId, {
        referenceMonth: '2026-07-01',
        type: AdjustmentIndexType.INCC,
        percentage: 0.48,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('applies type and date filters inside the owned property', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });
    prisma.adjustmentIndex.findMany.mockResolvedValue([adjustmentIndex]);

    await service.findAll(userId, propertyId, {
      type: AdjustmentIndexType.INCC,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(prisma.adjustmentIndex.findMany).toHaveBeenCalledWith({
      where: {
        propertyId,
        type: AdjustmentIndexType.INCC,
        referenceMonth: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T23:59:59.999Z'),
        },
      },
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('rejects an inverted date range', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });

    await expect(
      service.findAll(userId, propertyId, {
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not reveal an index owned by another user', async () => {
    prisma.adjustmentIndex.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('other-user', propertyId, adjustmentIndexId),
    ).rejects.toThrow(
      new NotFoundException('Índice de reajuste não encontrado'),
    );
    expect(prisma.adjustmentIndex.findFirst).toHaveBeenCalledWith({
      where: {
        id: adjustmentIndexId,
        propertyId,
        property: { userId: 'other-user' },
      },
    });
  });

  it('updates Decimal fields after an ownership-scoped lookup', async () => {
    prisma.adjustmentIndex.findFirst.mockResolvedValue(adjustmentIndex);
    prisma.adjustmentIndex.update.mockResolvedValue(adjustmentIndex);

    await service.update(userId, propertyId, adjustmentIndexId, {
      percentage: 0.62,
      amountImpact: null,
    });

    expect(prisma.adjustmentIndex.update).toHaveBeenCalledWith({
      where: { id: adjustmentIndexId },
      data: {
        percentage: new Prisma.Decimal('0.62'),
        amountImpact: null,
      },
    });
  });

  it('calculates the accumulated percentage using compound rates', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });
    prisma.adjustmentIndex.findMany.mockResolvedValue([
      {
        percentage: new Prisma.Decimal('0.48'),
        amountImpact: new Prisma.Decimal(4000),
      },
      {
        percentage: new Prisma.Decimal('0.62'),
        amountImpact: new Prisma.Decimal(5000),
      },
      {
        percentage: new Prisma.Decimal('0.55'),
        amountImpact: new Prisma.Decimal(3400),
      },
    ]);

    const result = await service.summary(userId, propertyId, {
      type: AdjustmentIndexType.INCC,
    });

    expect(prisma.adjustmentIndex.findMany).toHaveBeenCalledWith({
      where: { propertyId, type: AdjustmentIndexType.INCC },
      orderBy: [{ referenceMonth: 'asc' }, { createdAt: 'asc' }],
      select: { percentage: true, amountImpact: true },
    });
    expect(result.data).toEqual({
      type: AdjustmentIndexType.INCC,
      accumulatedPercentage: new Prisma.Decimal('1.659'),
      totalAmountImpact: new Prisma.Decimal(12400),
      initialPurchaseValue: new Prisma.Decimal(260000),
      estimatedAdjustedValue: new Prisma.Decimal(272400),
    });
  });

  it('returns zero totals when there are no indexes', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: propertyId,
      purchaseValue: new Prisma.Decimal(260000),
    });
    prisma.adjustmentIndex.findMany.mockResolvedValue([]);

    const result = await service.summary(userId, propertyId, {});

    expect(result.data).toEqual({
      type: null,
      accumulatedPercentage: new Prisma.Decimal(0),
      totalAmountImpact: new Prisma.Decimal(0),
      initialPurchaseValue: new Prisma.Decimal(260000),
      estimatedAdjustedValue: new Prisma.Decimal(260000),
    });
  });
});
