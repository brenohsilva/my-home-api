import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar a saúde da API e do banco de dados' })
  @ApiOkResponse({
    description: 'API e banco de dados estão disponíveis.',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-17T12:00:00.000Z',
        uptime: 120.45,
        checks: { database: 'up' },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'O banco de dados não está disponível.',
  })
  check() {
    return this.health.check();
  }
}
