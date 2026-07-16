import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Property } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreatePropertyDto): Promise<Property> {
    return this.prisma.property.create({
      data: this.toCreateData(userId, dto),
    });
  }

  async findAll(userId: string, query: ListPropertiesQueryDto) {
    const where: Prisma.PropertyWhereInput = {
      userId,
      ...(query.builderName && {
        builderName: { contains: query.builderName, mode: 'insensitive' },
      }),
      ...(query.city && {
        city: { contains: query.city, mode: 'insensitive' },
      }),
      ...(query.state && { state: query.state }),
      ...(query.address && {
        street: { contains: query.address, mode: 'insensitive' },
      }),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(userId: string, id: string): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: { id, userId },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdatePropertyDto,
  ): Promise<Property> {
    await this.findOne(userId, id);
    return this.prisma.property.update({
      where: { id },
      data: this.toUpdateData(dto),
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.property.delete({ where: { id } });
  }

  private toCreateData(
    userId: string,
    dto: CreatePropertyDto,
  ): Prisma.PropertyUncheckedCreateInput {
    return {
      userId,
      name: dto.name.trim(),
      builderName: dto.builderName.trim(),
      city: dto.city.trim(),
      state: dto.state,
      street: dto.street.trim(),
      purchaseDate: new Date(dto.purchaseDate),
      builderSignedDate: dto.builderSignedDate
        ? new Date(dto.builderSignedDate)
        : null,
      bankSignedDate: dto.bankSignedDate ? new Date(dto.bankSignedDate) : null,
      expectedKeyDate: dto.expectedKeyDate
        ? new Date(dto.expectedKeyDate)
        : null,
      assessedValue: new Prisma.Decimal(dto.assessedValue),
      purchaseValue: new Prisma.Decimal(dto.purchaseValue),
      currentStage: dto.currentStage,
      progressPercent: dto.progressPercent
        ? new Prisma.Decimal(dto.progressPercent)
        : null,
    };
  }

  private toUpdateData(dto: UpdatePropertyDto): Prisma.PropertyUpdateInput {
    return {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.builderName !== undefined && {
        builderName: dto.builderName.trim(),
      }),
      ...(dto.city !== undefined && { city: dto.city.trim() }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.street !== undefined && { street: dto.street.trim() }),
      ...(dto.purchaseDate !== undefined && {
        purchaseDate: new Date(dto.purchaseDate),
      }),
      ...(dto.builderSignedDate !== undefined && {
        builderSignedDate: new Date(dto.builderSignedDate),
      }),
      ...(dto.bankSignedDate !== undefined && {
        bankSignedDate: new Date(dto.bankSignedDate),
      }),
      ...(dto.expectedKeyDate !== undefined && {
        expectedKeyDate: new Date(dto.expectedKeyDate),
      }),
      ...(dto.assessedValue !== undefined && {
        assessedValue: new Prisma.Decimal(dto.assessedValue),
      }),
      ...(dto.purchaseValue !== undefined && {
        purchaseValue: new Prisma.Decimal(dto.purchaseValue),
      }),
      ...(dto.currentStage !== undefined && { currentStage: dto.currentStage }),
      ...(dto.progressPercent !== undefined && {
        progressPercent: new Prisma.Decimal(dto.progressPercent),
      }),
    };
  }
}
