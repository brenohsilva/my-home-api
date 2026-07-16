import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertySortBy, SortOrder } from './dto/list-properties-query.dto';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
  const property = {
    id: '4a9c5127-1d80-45b1-955f-3ee5c5ac58d7',
    userId: 'owner-id',
    name: 'Apartamento',
  };
  let prisma: {
    property: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: PropertiesService;

  beforeEach(() => {
    prisma = {
      property: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([[property], 1]),
    };
    service = new PropertiesService(prisma as unknown as PrismaService);
  });

  it('always scopes lookup to the authenticated owner', async () => {
    prisma.property.findFirst.mockResolvedValue(property);
    await service.findOne('owner-id', property.id);
    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: property.id, userId: 'owner-id' },
    });
  });

  it('returns not found instead of exposing another user property', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.findOne('other-user', property.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('applies pagination, filters, and ordering inside the owner scope', async () => {
    const result = await service.findAll('owner-id', {
      page: 2,
      limit: 10,
      city: 'Recife',
      state: 'PE',
      address: 'Flores',
      builderName: 'ACME',
      sortBy: PropertySortBy.PURCHASE_DATE,
      order: SortOrder.ASC,
    });
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { purchaseDate: 'asc' },
      }),
    );
    expect(prisma.property.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ userId: 'owner-id', state: 'PE' }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('uses Prisma Decimal for monetary values on creation', async () => {
    prisma.property.create.mockImplementation(({ data }) => data);
    await service.create('owner-id', {
      name: 'Apto',
      builderName: 'ACME',
      city: 'Recife',
      state: 'PE',
      street: 'Rua A',
      purchaseDate: '2026-01-01',
      assessedValue: '450000.00',
      purchaseValue: '420000.00',
    });
    const data = prisma.property.create.mock.calls[0][0].data;
    expect(data.assessedValue).toBeInstanceOf(Prisma.Decimal);
    expect(data.purchaseValue).toEqual(new Prisma.Decimal('420000.00'));
  });
});
