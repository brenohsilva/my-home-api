import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConstructionStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConstructionProgressService } from './construction-progress.service';
import { ConstructionProgressOrder } from './dto/list-construction-progress-query.dto';
import { SyncPropertyProgressUseCase } from './use-cases/sync-property-progress.use-case';

describe('ConstructionProgressService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const progressId = 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e';
  const progress = {
    id: progressId,
    propertyId,
    referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
    stage: ConstructionStage.STRUCTURE,
    progressPercent: new Prisma.Decimal(35),
    scheduledPercent: new Prisma.Decimal(42),
    notes: 'Estrutura concluída',
    createdAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    constructionProgress: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let transaction: {
    property: { update: jest.Mock };
    constructionProgress: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let service: ConstructionProgressService;

  beforeEach(() => {
    transaction = {
      property: { update: jest.fn() },
      constructionProgress: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    prisma = {
      property: { findFirst: jest.fn() },
      constructionProgress: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(
        (callback: (value: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(transaction as unknown as Prisma.TransactionClient),
      ),
    };
    service = new ConstructionProgressService(
      prisma as unknown as PrismaService,
      new SyncPropertyProgressUseCase(),
    );
  });

  it('creates progress with Decimal values and synchronizes the property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    transaction.constructionProgress.create.mockResolvedValue(progress);
    transaction.constructionProgress.findFirst.mockResolvedValue(progress);

    await service.create(userId, propertyId, {
      referenceMonth: '2026-07-01',
      stage: ConstructionStage.STRUCTURE,
      progressPercent: 35,
      scheduledPercent: 42,
      notes: ' Estrutura concluída ',
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    expect(transaction.constructionProgress.create).toHaveBeenCalledWith({
      data: {
        propertyId,
        referenceMonth: new Date('2026-07-01T00:00:00.000Z'),
        stage: ConstructionStage.STRUCTURE,
        progressPercent: new Prisma.Decimal(35),
        scheduledPercent: new Prisma.Decimal(42),
        notes: 'Estrutura concluída',
      },
    });
    expect(transaction.property.update).toHaveBeenCalled();
  });

  it('lists owned progress with period filters and requested order', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.constructionProgress.findMany.mockResolvedValue([progress]);

    await service.findAll(userId, propertyId, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      order: ConstructionProgressOrder.ASC,
    });

    expect(prisma.constructionProgress.findMany).toHaveBeenCalledWith({
      where: {
        propertyId,
        referenceMonth: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T23:59:59.999Z'),
        },
      },
      orderBy: [
        { referenceMonth: ConstructionProgressOrder.ASC },
        { createdAt: ConstructionProgressOrder.ASC },
      ],
    });
  });

  it('rejects an inverted date range', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });

    await expect(
      service.findAll(userId, propertyId, {
        startDate: '2026-12-31',
        endDate: '2026-01-01',
        order: ConstructionProgressOrder.DESC,
      }),
    ).rejects.toThrow(
      new BadRequestException('startDate não pode ser posterior a endDate'),
    );
  });

  it('does not reveal a progress record owned by another user', async () => {
    prisma.constructionProgress.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('other-user', propertyId, progressId),
    ).rejects.toThrow(
      new NotFoundException('Atualização da obra não encontrada'),
    );
    expect(prisma.constructionProgress.findFirst).toHaveBeenCalledWith({
      where: {
        id: progressId,
        propertyId,
        property: { userId: 'other-user' },
      },
    });
  });

  it('returns the latest progress and Decimal difference', async () => {
    prisma.constructionProgress.findFirst.mockResolvedValue({
      stage: progress.stage,
      progressPercent: progress.progressPercent,
      scheduledPercent: progress.scheduledPercent,
      referenceMonth: progress.referenceMonth,
    });

    const result = await service.latest(userId, propertyId);

    expect(result.data).toEqual({
      stage: ConstructionStage.STRUCTURE,
      progressPercent: new Prisma.Decimal(35),
      scheduledPercent: new Prisma.Decimal(42),
      difference: new Prisma.Decimal(-7),
      referenceMonth: '2026-07-01',
    });
  });

  it('returns chronological comparison data with date-only months', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.constructionProgress.findMany.mockResolvedValue([
      {
        referenceMonth: progress.referenceMonth,
        progressPercent: progress.progressPercent,
        scheduledPercent: progress.scheduledPercent,
      },
    ]);

    const result = await service.comparison(userId, propertyId);

    expect(result.data).toEqual([
      {
        referenceMonth: '2026-07-01',
        progressPercent: new Prisma.Decimal(35),
        scheduledPercent: new Prisma.Decimal(42),
      },
    ]);
  });

  it('deletes inside a transaction and resynchronizes the property', async () => {
    prisma.constructionProgress.findFirst.mockResolvedValue(progress);
    transaction.constructionProgress.delete.mockResolvedValue(progress);
    transaction.constructionProgress.findFirst.mockResolvedValue(null);

    await service.remove(userId, propertyId, progressId);

    expect(transaction.constructionProgress.delete).toHaveBeenCalledWith({
      where: { id: progressId },
    });
    expect(transaction.property.update).toHaveBeenCalledWith({
      where: { id: propertyId },
      data: { currentStage: null, progressPercent: null },
    });
  });
});
