import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class ExpensesService {
  constructor(readonly prisma: PrismaService) {}
}
