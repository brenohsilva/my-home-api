import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConstructionProgress,
  ConstructionStage,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConstructionProgressDto } from './dto/create-construction-progress.dto';
import { ListConstructionProgressQueryDto } from './dto/list-construction-progress-query.dto';
import { UpdateConstructionProgressDto } from './dto/update-construction-progress.dto';
import { SyncPropertyProgressUseCase } from './use-cases/sync-property-progress.use-case';

interface ConstructionProgressUpdateData {
  referenceMonth?: Date;
  stage?: ConstructionStage | null;
  progressPercent?: Prisma.Decimal;
  scheduledPercent?: Prisma.Decimal;
  notes?: string | null;
}

@Injectable()
export class ConstructionProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncPropertyProgress: SyncPropertyProgressUseCase,
  ) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreateConstructionProgressDto,
  ): Promise<ConstructionProgress> {
    await this.ensureOwnedProperty(userId, propertyId);

    return this.prisma.$transaction(async (transaction) => {
      const progress = await transaction.constructionProgress.create({
        data: {
          propertyId,
          referenceMonth: this.parseDate(dto.referenceMonth),
          stage: dto.stage ?? null,
          progressPercent: new Prisma.Decimal(dto.progressPercent),
          scheduledPercent: new Prisma.Decimal(dto.scheduledPercent),
          notes: dto.notes?.trim() || null,
        },
      });
      await this.syncPropertyProgress.execute(transaction, propertyId);
      return progress;
    });
  }

  async findAll(
    userId: string,
    propertyId: string,
    query: ListConstructionProgressQueryDto,
  ): Promise<ConstructionProgress[]> {
    await this.ensureOwnedProperty(userId, propertyId);
    const where = this.buildListWhere(propertyId, query);
    return this.prisma.constructionProgress.findMany({
      where,
      orderBy: [{ referenceMonth: query.order }, { createdAt: query.order }],
    });
  }

  async findOne(
    userId: string,
    propertyId: string,
    progressId: string,
  ): Promise<ConstructionProgress> {
    const progress = await this.prisma.constructionProgress.findFirst({
      where: { id: progressId, propertyId, property: { userId } },
    });
    if (!progress) {
      throw new NotFoundException('Atualização da obra não encontrada');
    }
    return progress;
  }

  async update(
    userId: string,
    propertyId: string,
    progressId: string,
    dto: UpdateConstructionProgressDto,
  ): Promise<ConstructionProgress> {
    await this.findOne(userId, propertyId, progressId);

    return this.prisma.$transaction(async (transaction) => {
      const progress = await transaction.constructionProgress.update({
        where: { id: progressId },
        data: this.toUpdateData(dto),
      });
      await this.syncPropertyProgress.execute(transaction, propertyId);
      return progress;
    });
  }

  async remove(
    userId: string,
    propertyId: string,
    progressId: string,
  ): Promise<void> {
    await this.findOne(userId, propertyId, progressId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.constructionProgress.delete({
        where: { id: progressId },
      });
      await this.syncPropertyProgress.execute(transaction, propertyId);
    });
  }

  async latest(userId: string, propertyId: string) {
    const latest = await this.prisma.constructionProgress.findFirst({
      where: { propertyId, property: { userId } },
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
      select: {
        stage: true,
        progressPercent: true,
        scheduledPercent: true,
        referenceMonth: true,
      },
    });
    if (!latest) {
      throw new NotFoundException('Atualização da obra não encontrada');
    }

    return {
      data: {
        ...latest,
        difference: latest.progressPercent.minus(latest.scheduledPercent),
        referenceMonth: this.formatDate(latest.referenceMonth),
      },
    };
  }

  async comparison(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const progress = await this.prisma.constructionProgress.findMany({
      where: { propertyId },
      orderBy: [{ referenceMonth: 'asc' }, { createdAt: 'asc' }],
      select: {
        referenceMonth: true,
        progressPercent: true,
        scheduledPercent: true,
      },
    });

    return {
      data: progress.map((item) => ({
        ...item,
        referenceMonth: this.formatDate(item.referenceMonth),
      })),
    };
  }

  private buildListWhere(
    propertyId: string,
    query: ListConstructionProgressQueryDto,
  ): Prisma.ConstructionProgressWhereInput {
    if (
      query.startDate &&
      query.endDate &&
      this.parseDate(query.startDate) > this.parseDate(query.endDate)
    ) {
      throw new BadRequestException(
        'startDate não pode ser posterior a endDate',
      );
    }
    const referenceMonth: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: this.parseDate(query.startDate) }),
      ...(query.endDate && {
        lte: this.endOfDay(this.parseDate(query.endDate)),
      }),
    };

    return {
      propertyId,
      ...(Object.keys(referenceMonth).length > 0 && { referenceMonth }),
    };
  }

  private toUpdateData(
    dto: UpdateConstructionProgressDto,
  ): ConstructionProgressUpdateData {
    return {
      ...(dto.referenceMonth !== undefined && {
        referenceMonth: this.parseDate(dto.referenceMonth),
      }),
      ...(dto.stage !== undefined && { stage: dto.stage }),
      ...(dto.progressPercent !== undefined && {
        progressPercent: new Prisma.Decimal(dto.progressPercent),
      }),
      ...(dto.scheduledPercent !== undefined && {
        scheduledPercent: new Prisma.Decimal(dto.scheduledPercent),
      }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
    };
  }

  private async ensureOwnedProperty(
    userId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, userId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private endOfDay(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
