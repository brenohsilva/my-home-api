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
import { CreateConstructionFeeDto } from './dto/create-construction-fee.dto';
import { ListConstructionFeesQueryDto } from './dto/list-construction-fees-query.dto';
import { PayConstructionFeeDto } from './dto/pay-construction-fee.dto';
import { UpdateConstructionFeeDto } from './dto/update-construction-fee.dto';
import { ConstructionFeesService } from './construction-fees.service';

@ApiTags('construction-fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/construction-fees')
export class ConstructionFeesController {
  constructor(private readonly constructionFees: ConstructionFeesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar uma taxa de obra' })
  @ApiCreatedResponse({ description: 'Taxa de obra cadastrada.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateConstructionFeeDto,
  ) {
    return this.constructionFees.create(user.id, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar taxas de obra com paginação e filtros' })
  @ApiOkResponse({ description: 'Lista paginada de taxas de obra.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListConstructionFeesQueryDto,
  ) {
    return this.constructionFees.findAll(user.id, propertyId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Consultar o resumo das taxas de obra' })
  @ApiOkResponse({ description: 'Indicadores financeiros das taxas.' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.constructionFees.summary(user.id, propertyId);
  }

  @Get('evolution')
  @ApiOperation({ summary: 'Consultar a evolução mensal das taxas de obra' })
  @ApiOkResponse({ description: 'Série cronológica das taxas.' })
  evolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.constructionFees.evolution(user.id, propertyId);
  }

  @Get(':constructionFeeId')
  @ApiOperation({ summary: 'Consultar uma taxa de obra' })
  @ApiOkResponse({ description: 'Taxa de obra encontrada.' })
  @ApiNotFoundResponse({ description: 'Taxa de obra não encontrada.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('constructionFeeId', ParseUUIDPipe) constructionFeeId: string,
  ) {
    return this.constructionFees.findOne(
      user.id,
      propertyId,
      constructionFeeId,
    );
  }

  @Patch(':constructionFeeId')
  @ApiOperation({ summary: 'Atualizar uma taxa de obra' })
  @ApiOkResponse({ description: 'Taxa de obra atualizada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('constructionFeeId', ParseUUIDPipe) constructionFeeId: string,
    @Body() dto: UpdateConstructionFeeDto,
  ) {
    return this.constructionFees.update(
      user.id,
      propertyId,
      constructionFeeId,
      dto,
    );
  }

  @Patch(':constructionFeeId/pay')
  @ApiOperation({ summary: 'Registrar uma taxa de obra como paga' })
  @ApiOkResponse({ description: 'Taxa de obra paga.' })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('constructionFeeId', ParseUUIDPipe) constructionFeeId: string,
    @Body() dto: PayConstructionFeeDto,
  ) {
    return this.constructionFees.pay(
      user.id,
      propertyId,
      constructionFeeId,
      dto,
    );
  }

  @Delete(':constructionFeeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir uma taxa de obra' })
  @ApiNoContentResponse({ description: 'Taxa de obra excluída.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('constructionFeeId', ParseUUIDPipe) constructionFeeId: string,
  ) {
    return this.constructionFees.remove(user.id, propertyId, constructionFeeId);
  }
}
