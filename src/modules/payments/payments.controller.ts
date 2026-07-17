import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { DeletePaymentsDto } from './dto/delete-payments.dto';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { GenerateIntermediateInstallmentsDto } from './dto/generate-intermediate-installments.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PayPaymentDto } from './dto/pay-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpcomingPaymentsQueryDto } from './dto/upcoming-payments-query.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar um pagamento' })
  @ApiCreatedResponse({ description: 'Pagamento cadastrado.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(user.id, propertyId, dto);
  }

  @Post('generate-installments')
  @ApiOperation({ summary: 'Gerar uma série de pagamentos parcelados' })
  @ApiCreatedResponse({ description: 'Parcelas geradas em uma transação.' })
  generateInstallments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: GenerateInstallmentsDto,
  ) {
    return this.payments.generateInstallments(user.id, propertyId, dto);
  }

  @Post('generate-intermediate-installments')
  @ApiOperation({
    summary: 'Gerar parcelas intermediárias com frequência anual',
  })
  @ApiCreatedResponse({ description: 'Parcelas intermediárias geradas.' })
  generateIntermediateInstallments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: GenerateIntermediateInstallmentsDto,
  ) {
    return this.payments.generateIntermediateInstallments(
      user.id,
      propertyId,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar pagamentos com paginação e filtros' })
  @ApiOkResponse({ description: 'Lista paginada de pagamentos.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.payments.findAll(user.id, propertyId, query);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Consultar os próximos pagamentos pendentes' })
  @ApiOkResponse({ description: 'Próximos pagamentos.' })
  upcoming(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: UpcomingPaymentsQueryDto,
  ) {
    return this.payments.upcoming(user.id, propertyId, query);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Consultar pagamentos em atraso' })
  @ApiOkResponse({ description: 'Pagamentos pendentes já vencidos.' })
  overdue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.payments.overdue(user.id, propertyId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Consultar o resumo financeiro dos pagamentos' })
  @ApiOkResponse({ description: 'Totais e contagens dos pagamentos.' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.payments.summary(user.id, propertyId);
  }

  @Get(':paymentId')
  @ApiOperation({ summary: 'Consultar um pagamento' })
  @ApiOkResponse({ description: 'Pagamento encontrado.' })
  @ApiNotFoundResponse({ description: 'Pagamento não encontrado.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.findOne(user.id, propertyId, paymentId);
  }

  @Patch(':paymentId')
  @ApiOperation({ summary: 'Atualizar um pagamento' })
  @ApiOkResponse({ description: 'Pagamento atualizado.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.payments.update(user.id, propertyId, paymentId, dto);
  }

  @Patch(':paymentId/pay')
  @ApiOperation({ summary: 'Registrar um pagamento como pago' })
  @ApiOkResponse({ description: 'Pagamento quitado.' })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: PayPaymentDto,
  ) {
    return this.payments.pay(user.id, propertyId, paymentId, dto);
  }

  @Patch(':paymentId/reopen')
  @ApiOperation({ summary: 'Reabrir um pagamento como pendente' })
  @ApiOkResponse({ description: 'Pagamento reaberto.' })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.reopen(user.id, propertyId, paymentId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir vários pagamentos' })
  @ApiNoContentResponse({ description: 'Pagamentos excluídos.' })
  removeMany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: DeletePaymentsDto,
  ) {
    return this.payments.removeMany(user.id, propertyId, dto);
  }

  @Delete(':paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir um pagamento' })
  @ApiNoContentResponse({ description: 'Pagamento excluído.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.remove(user.id, propertyId, paymentId);
  }
}
