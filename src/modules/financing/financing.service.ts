import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Financing, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';

type FinancingData = Pick<
  Prisma.FinancingUncheckedCreateInput,
  | 'bankName'
  | 'financedAmount'
  | 'installmentCount'
  | 'interestRateYear'
  | 'interestRateMonth'
  | 'system'
>;

@Injectable()
export class FinancingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreateFinancingDto,
  ): Promise<Financing> {
    await this.ensureOwnedProperty(userId, propertyId);

    const existing = await this.prisma.financing.findUnique({
      where: { propertyId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('O imóvel já possui um financiamento');
    }

    try {
      return await this.prisma.financing.create({
        data: { propertyId, ...this.toData(dto) },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('O imóvel já possui um financiamento');
      }
      throw error;
    }
  }

  async findOne(userId: string, propertyId: string): Promise<Financing> {
    const financing = await this.prisma.financing.findFirst({
      where: { propertyId, property: { userId } },
    });
    if (!financing) {
      throw new NotFoundException('Financiamento não encontrado');
    }
    return financing;
  }

  async update(
    userId: string,
    propertyId: string,
    dto: UpdateFinancingDto,
  ): Promise<Financing> {
    await this.findOne(userId, propertyId);
    return this.prisma.financing.update({
      where: { propertyId },
      data: this.toData(dto),
    });
  }

  async remove(userId: string, propertyId: string): Promise<void> {
    await this.findOne(userId, propertyId);
    await this.prisma.financing.delete({ where: { propertyId } });
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

  private toData(dto: CreateFinancingDto | UpdateFinancingDto): FinancingData {
    return {
      ...(dto.bankName !== undefined && { bankName: dto.bankName.trim() }),
      ...(dto.financedAmount !== undefined && {
        financedAmount: new Prisma.Decimal(dto.financedAmount),
      }),
      ...(dto.installmentCount !== undefined && {
        installmentCount: dto.installmentCount,
      }),
      ...(dto.interestRateYear !== undefined && {
        interestRateYear: new Prisma.Decimal(dto.interestRateYear),
      }),
      ...(dto.interestRateMonth !== undefined && {
        interestRateMonth: new Prisma.Decimal(dto.interestRateMonth),
      }),
      ...(dto.system !== undefined && { system: dto.system }),
    };
  }
}
