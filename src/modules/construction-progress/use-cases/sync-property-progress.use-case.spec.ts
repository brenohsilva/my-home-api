import { ConstructionStage, Prisma } from '@prisma/client';
import { SyncPropertyProgressUseCase } from './sync-property-progress.use-case';

describe('SyncPropertyProgressUseCase', () => {
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const useCase = new SyncPropertyProgressUseCase();
  let transaction: {
    constructionProgress: { findFirst: jest.Mock };
    property: { update: jest.Mock };
  };

  beforeEach(() => {
    transaction = {
      constructionProgress: { findFirst: jest.fn() },
      property: { update: jest.fn() },
    };
  });

  it('synchronizes the property with the latest progress record', async () => {
    transaction.constructionProgress.findFirst.mockResolvedValue({
      stage: ConstructionStage.STRUCTURE,
      progressPercent: new Prisma.Decimal(35),
    });

    await useCase.execute(
      transaction as unknown as Prisma.TransactionClient,
      propertyId,
    );

    expect(transaction.constructionProgress.findFirst).toHaveBeenCalledWith({
      where: { propertyId },
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
      select: { stage: true, progressPercent: true },
    });
    expect(transaction.property.update).toHaveBeenCalledWith({
      where: { id: propertyId },
      data: {
        currentStage: ConstructionStage.STRUCTURE,
        progressPercent: new Prisma.Decimal(35),
      },
    });
  });

  it('clears property progress when no history remains', async () => {
    transaction.constructionProgress.findFirst.mockResolvedValue(null);

    await useCase.execute(
      transaction as unknown as Prisma.TransactionClient,
      propertyId,
    );

    expect(transaction.property.update).toHaveBeenCalledWith({
      where: { id: propertyId },
      data: { currentStage: null, progressPercent: null },
    });
  });
});
