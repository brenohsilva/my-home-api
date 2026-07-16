import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class ConstructionProgressService {
  constructor(readonly prisma: PrismaService) {}
}
