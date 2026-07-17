import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let prisma: { $queryRaw: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('reports the API and database as healthy', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      checks: { database: 'up' },
    });
  });

  it('returns service unavailable without exposing database details', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection details'));

    await expect(service.check()).rejects.toThrow(
      new ServiceUnavailableException('Database unavailable'),
    );
  });
});
