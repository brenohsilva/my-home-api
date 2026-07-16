import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinancingService {
  constructor(readonly prisma: PrismaService) {}
}
