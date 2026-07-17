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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar uma despesa' })
  @ApiCreatedResponse({ description: 'Despesa cadastrada.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(user.id, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar despesas com paginação e filtros' })
  @ApiOkResponse({ description: 'Lista paginada de despesas.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListExpensesQueryDto,
  ) {
    return this.expenses.findAll(user.id, propertyId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Consultar o resumo financeiro das despesas' })
  @ApiOkResponse({ description: 'Totais e agrupamento por categoria.' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.expenses.summary(user.id, propertyId);
  }

  @Get(':expenseId')
  @ApiOperation({ summary: 'Consultar uma despesa' })
  @ApiOkResponse({ description: 'Despesa encontrada.' })
  @ApiNotFoundResponse({ description: 'Despesa não encontrada.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.findOne(user.id, propertyId, expenseId);
  }

  @Patch(':expenseId')
  @ApiOperation({ summary: 'Atualizar uma despesa' })
  @ApiOkResponse({ description: 'Despesa atualizada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(user.id, propertyId, expenseId, dto);
  }

  @Patch(':expenseId/pay')
  @ApiOperation({ summary: 'Registrar uma despesa como paga' })
  @ApiOkResponse({ description: 'Despesa paga.' })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: PayExpenseDto,
  ) {
    return this.expenses.pay(user.id, propertyId, expenseId, dto);
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir uma despesa' })
  @ApiNoContentResponse({ description: 'Despesa excluída.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenses.remove(user.id, propertyId, expenseId);
  }
}
