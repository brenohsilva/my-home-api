import { PaymentType } from '@prisma/client';
import { InstallmentFrequency } from '../dto/generate-installments.dto';
import { GenerateInstallmentsUseCase } from './generate-installments.use-case';

const formatDate = (value: string | Date): string =>
  new Date(value instanceof Date ? value.getTime() : value)
    .toISOString()
    .slice(0, 10);

describe('GenerateInstallmentsUseCase', () => {
  const useCase = new GenerateInstallmentsUseCase();

  it('generates sequential descriptions and monthly due dates', () => {
    const records = useCase.execute({
      propertyId: 'property-id',
      description: 'Parcela da entrada',
      type: PaymentType.MONTHLY_INSTALLMENT,
      installmentCount: 3,
      installmentAmount: 700,
      firstDueDate: '2026-02-10',
      frequency: InstallmentFrequency.MONTHLY,
    });

    expect(records.map(({ description }) => description)).toEqual([
      'Parcela da entrada 1/3',
      'Parcela da entrada 2/3',
      'Parcela da entrada 3/3',
    ]);
    expect(records.map(({ dueDate }) => formatDate(dueDate))).toEqual([
      '2026-02-10',
      '2026-03-10',
      '2026-04-10',
    ]);
  });

  it('uses the last valid day when generating from a month end', () => {
    const records = useCase.execute({
      propertyId: 'property-id',
      description: 'Mensal',
      type: PaymentType.MONTHLY_INSTALLMENT,
      installmentCount: 3,
      installmentAmount: 100,
      firstDueDate: '2026-01-31',
      frequency: InstallmentFrequency.MONTHLY,
    });

    expect(records.map(({ dueDate }) => formatDate(dueDate))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('keeps yearly installments in the same month', () => {
    const records = useCase.execute({
      propertyId: 'property-id',
      description: 'Parcela intermediária de dezembro',
      type: PaymentType.INTERMEDIATE_INSTALLMENT,
      installmentCount: 3,
      installmentAmount: 3000,
      firstDueDate: '2026-12-10',
      frequency: InstallmentFrequency.YEARLY,
    });

    expect(records.map(({ dueDate }) => formatDate(dueDate))).toEqual([
      '2026-12-10',
      '2027-12-10',
      '2028-12-10',
    ]);
  });
});
