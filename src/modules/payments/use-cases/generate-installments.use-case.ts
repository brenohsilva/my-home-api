import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { InstallmentFrequency } from '../dto/generate-installments.dto';

export interface GenerateInstallmentsInput {
  propertyId: string;
  description: string;
  type: PaymentType;
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string;
  frequency: InstallmentFrequency;
}

@Injectable()
export class GenerateInstallmentsUseCase {
  execute(
    input: GenerateInstallmentsInput,
  ): Prisma.PaymentUncheckedCreateInput[] {
    const firstDueDate = this.parseDate(input.firstDueDate);

    return Array.from({ length: input.installmentCount }, (_, index) => ({
      propertyId: input.propertyId,
      description: `${input.description.trim()} ${index + 1}/${input.installmentCount}`,
      type: input.type,
      status: PaymentStatus.PENDING,
      dueDate: this.addFrequency(firstDueDate, index, input.frequency),
      expectedAmount: new Prisma.Decimal(input.installmentAmount),
    }));
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private addFrequency(
    firstDate: Date,
    index: number,
    frequency: InstallmentFrequency,
  ): Date {
    const sourceYear = firstDate.getUTCFullYear();
    const sourceMonth = firstDate.getUTCMonth();
    const sourceDay = firstDate.getUTCDate();
    const monthOffset =
      frequency === InstallmentFrequency.MONTHLY ? index : index * 12;
    const absoluteMonth = sourceMonth + monthOffset;
    const targetYear = sourceYear + Math.floor(absoluteMonth / 12);
    const targetMonth = absoluteMonth % 12;
    const lastDay = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();

    return new Date(
      Date.UTC(targetYear, targetMonth, Math.min(sourceDay, lastDay)),
    );
  }
}
