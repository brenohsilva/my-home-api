import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class ConstructionFeesService {
  constructor(readonly prisma: PrismaService) {}
}
