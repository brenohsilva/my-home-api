import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class PaymentsService {
  constructor(readonly prisma: PrismaService) {}
}
