import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { DashboardService } from './dashboard.service';
import { FinancialCalendarQueryDto } from './dto/financial-calendar-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar o dashboard principal do imóvel' })
  @ApiOkResponse({ description: 'Dashboard consolidado do imóvel.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.dashboard.getDashboard(user.id, propertyId);
  }

  @Get('financial-summary')
  @ApiOperation({ summary: 'Consultar o resumo financeiro consolidado' })
  @ApiOkResponse({ description: 'Resumo financeiro do imóvel.' })
  financialSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.dashboard.financialSummary(user.id, propertyId);
  }

  @Get('financial-calendar')
  @ApiOperation({ summary: 'Consultar o calendário financeiro' })
  @ApiOkResponse({ description: 'Compromissos financeiros por data.' })
  financialCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: FinancialCalendarQueryDto,
  ) {
    return this.dashboard.financialCalendar(user.id, propertyId, query);
  }

  @Get('key-delivery-forecast')
  @ApiOperation({ summary: 'Consultar a previsão até a entrega das chaves' })
  @ApiOkResponse({ description: 'Previsão financeira estimada.' })
  keyDeliveryForecast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.dashboard.keyDeliveryForecast(user.id, propertyId);
  }
}
