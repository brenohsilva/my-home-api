import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Expense,
  ExpenseCategory,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

interface ExpenseUpdateData {
  description?: string;
  category?: ExpenseCategory;
  status?: PaymentStatus;
  dueDate?: Date | null;
  expectedAmount?: Prisma.Decimal;
  paidDate?: Date | null;
  paidAmount?: Prisma.Decimal | null;
  notes?: string | null;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    await this.ensureOwnedProperty(userId, propertyId);
    const status = dto.status ?? PaymentStatus.PENDING;
    const paidDate = dto.paidDate ? this.parseDate(dto.paidDate) : null;
    const paidAmount =
      dto.paidAmount !== undefined && dto.paidAmount !== null
        ? new Prisma.Decimal(dto.paidAmount)
        : null;
    this.validateExpenseState(status, paidDate, paidAmount);

    return this.prisma.expense.create({
      data: {
        propertyId,
        description: dto.description.trim(),
        category: dto.category,
        status,
        dueDate: dto.dueDate ? this.parseDate(dto.dueDate) : null,
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
        paidDate,
        paidAmount,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async findAll(
    userId: string,
    propertyId: string,
    query: ListExpensesQueryDto,
  ) {
    await this.ensureOwnedProperty(userId, propertyId);
    const where = this.buildListWhere(propertyId, query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.expense.count({ where }),
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

  async findOne(
    userId: string,
    propertyId: string,
    expenseId: string,
  ): Promise<Expense> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, propertyId, property: { userId } },
    });
    if (!expense) throw new NotFoundException('Despesa não encontrada');
    return expense;
  }

  async update(
    userId: string,
    propertyId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const current = await this.findOne(userId, propertyId, expenseId);
    const data = this.toUpdateData(dto);
    const resultingStatus = dto.status ?? current.status;
    const resultingPaidDate =
      data.paidDate !== undefined ? data.paidDate : current.paidDate;
    const resultingPaidAmount =
      data.paidAmount !== undefined ? data.paidAmount : current.paidAmount;
    this.validateExpenseState(
      resultingStatus,
      resultingPaidDate,
      resultingPaidAmount,
    );

    return this.prisma.expense.update({ where: { id: expenseId }, data });
  }

  async pay(
    userId: string,
    propertyId: string,
    expenseId: string,
    dto: PayExpenseDto,
  ): Promise<Expense> {
    await this.findOne(userId, propertyId, expenseId);
    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: PaymentStatus.PAID,
        paidDate: this.parseDate(dto.paidDate),
        paidAmount: new Prisma.Decimal(dto.paidAmount),
      },
    });
  }

  async remove(
    userId: string,
    propertyId: string,
    expenseId: string,
  ): Promise<void> {
    await this.findOne(userId, propertyId, expenseId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
  }

  async summary(userId: string, propertyId: string) {
    await this.ensureOwnedProperty(userId, propertyId);
    const pendingStatuses = [PaymentStatus.PENDING, PaymentStatus.OVERDUE];
    const [expected, paid, pending, categories] =
      await this.prisma.$transaction([
        this.prisma.expense.aggregate({
          where: { propertyId, status: { not: PaymentStatus.CANCELED } },
          _sum: { expectedAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: { propertyId, status: PaymentStatus.PAID },
          _sum: { paidAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: { propertyId, status: { in: pendingStatuses } },
          _sum: { expectedAmount: true },
        }),
        this.prisma.expense.groupBy({
          by: ['category'],
          where: { propertyId, status: { not: PaymentStatus.CANCELED } },
          _sum: { expectedAmount: true, paidAmount: true },
          orderBy: { category: 'asc' },
        }),
      ]);

    return {
      data: {
        expectedTotal: expected._sum.expectedAmount ?? new Prisma.Decimal(0),
        paidTotal: paid._sum.paidAmount ?? new Prisma.Decimal(0),
        pendingTotal: pending._sum.expectedAmount ?? new Prisma.Decimal(0),
        byCategory: categories.map((category) => ({
          category: category.category,
          expectedAmount:
            category._sum?.expectedAmount ?? new Prisma.Decimal(0),
          paidAmount: category._sum?.paidAmount ?? new Prisma.Decimal(0),
        })),
      },
    };
  }

  private buildListWhere(
    propertyId: string,
    query: ListExpensesQueryDto,
  ): Prisma.ExpenseWhereInput {
    if (
      query.startDate &&
      query.endDate &&
      this.parseDate(query.startDate) > this.parseDate(query.endDate)
    ) {
      throw new BadRequestException(
        'startDate não pode ser posterior a endDate',
      );
    }
    const dueDate: Prisma.DateTimeNullableFilter = {
      ...(query.startDate && { gte: this.parseDate(query.startDate) }),
      ...(query.endDate && {
        lte: this.endOfDay(this.parseDate(query.endDate)),
      }),
    };

    return {
      propertyId,
      ...(query.category && { category: query.category }),
      ...(query.status && { status: query.status }),
      ...(Object.keys(dueDate).length > 0 && { dueDate }),
    };
  }

  private toUpdateData(dto: UpdateExpenseDto): ExpenseUpdateData {
    return {
      ...(dto.description !== undefined && {
        description: dto.description.trim(),
      }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? this.parseDate(dto.dueDate) : null,
      }),
      ...(dto.expectedAmount !== undefined && {
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
      }),
      ...(dto.paidDate !== undefined && {
        paidDate: dto.paidDate ? this.parseDate(dto.paidDate) : null,
      }),
      ...(dto.paidAmount !== undefined && {
        paidAmount:
          dto.paidAmount === null ? null : new Prisma.Decimal(dto.paidAmount),
      }),
      ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
    };
  }

  private validateExpenseState(
    status: PaymentStatus,
    paidDate: Date | null,
    paidAmount: Prisma.Decimal | null,
  ): void {
    if (status === PaymentStatus.PAID && (!paidDate || paidAmount === null)) {
      throw new BadRequestException(
        'Despesas pagas devem informar paidDate e paidAmount',
      );
    }
    if (
      status !== PaymentStatus.PAID &&
      (paidDate !== null || paidAmount !== null)
    ) {
      throw new BadRequestException(
        'Apenas despesas pagas podem possuir dados de pagamento',
      );
    }
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
}
