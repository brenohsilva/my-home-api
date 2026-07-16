import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class AdjustmentIndexesService {
  constructor(readonly prisma: PrismaService) {}
}
