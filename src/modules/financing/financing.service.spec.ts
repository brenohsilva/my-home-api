import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinancingSystem, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancingService } from './financing.service';

describe('FinancingService', () => {
  const userId = 'owner-id';
  const propertyId = '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7';
  const financing = {
    id: 'fe0fb032-ecae-48c9-94f7-17be8e96ff3e',
    propertyId,
    bankName: 'Caixa Econômica Federal',
    financedAmount: new Prisma.Decimal('230000.00'),
    installmentCount: 420,
    interestRateYear: new Prisma.Decimal('7.66'),
    interestRateMonth: new Prisma.Decimal('0.616'),
    system: FinancingSystem.SAC,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let prisma: {
    property: { findFirst: jest.Mock };
    financing: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: FinancingService;

  beforeEach(() => {
    prisma = {
      property: { findFirst: jest.fn() },
      financing: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new FinancingService(prisma as unknown as PrismaService);
  });

  it('creates financing only for a property owned by the user', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.financing.findUnique.mockResolvedValue(null);
    prisma.financing.create.mockResolvedValue(financing);

    await service.create(userId, propertyId, {
      bankName: ' Caixa Econômica Federal ',
      financedAmount: 230000,
      installmentCount: 420,
      interestRateYear: 7.66,
      interestRateMonth: 0.616,
      system: FinancingSystem.SAC,
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    const data = prisma.financing.create.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({
        propertyId,
        bankName: 'Caixa Econômica Federal',
        financedAmount: new Prisma.Decimal('230000'),
        interestRateYear: new Prisma.Decimal('7.66'),
        interestRateMonth: new Prisma.Decimal('0.616'),
      }),
    );
  });

  it('rejects creation for a property owned by another user', async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(service.create('other-user', propertyId, {})).rejects.toThrow(
      new NotFoundException('Imóvel não encontrado'),
    );
    expect(prisma.financing.create).not.toHaveBeenCalled();
  });

  it('rejects a second financing for the same property', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyId });
    prisma.financing.findUnique.mockResolvedValue({ id: financing.id });

    await expect(service.create(userId, propertyId, {})).rejects.toThrow(
      new ConflictException('O imóvel já possui um financiamento'),
    );
  });

  it('scopes financing lookup through the property owner', async () => {
    prisma.financing.findFirst.mockResolvedValue(financing);

    await service.findOne(userId, propertyId);

    expect(prisma.financing.findFirst).toHaveBeenCalledWith({
      where: { propertyId, property: { userId } },
    });
  });

  it('does not reveal financing owned by another user', async () => {
    prisma.financing.findFirst.mockResolvedValue(null);

    await expect(service.findOne('other-user', propertyId)).rejects.toThrow(
      new NotFoundException('Financiamento não encontrado'),
    );
  });

  it('updates and deletes only after an ownership-scoped lookup', async () => {
    prisma.financing.findFirst.mockResolvedValue(financing);
    prisma.financing.update.mockResolvedValue(financing);
    prisma.financing.delete.mockResolvedValue(financing);

    await service.update(userId, propertyId, { installmentCount: 360 });
    await service.remove(userId, propertyId);

    expect(prisma.financing.update).toHaveBeenCalledWith({
      where: { propertyId },
      data: { installmentCount: 360 },
    });
    expect(prisma.financing.delete).toHaveBeenCalledWith({
      where: { propertyId },
    });
    expect(prisma.financing.findFirst).toHaveBeenCalledTimes(2);
  });
});
