import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SyncPropertyProgressUseCase {
  async execute(
    transaction: Prisma.TransactionClient,
    propertyId: string,
  ): Promise<void> {
    const latest = await transaction.constructionProgress.findFirst({
      where: { propertyId },
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
      select: { stage: true, progressPercent: true },
    });

    await transaction.property.update({
      where: { id: propertyId },
      data: {
        currentStage: latest?.stage ?? null,
        progressPercent: latest?.progressPercent ?? null,
      },
    });
  }
}
