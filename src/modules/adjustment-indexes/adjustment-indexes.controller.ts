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
  ApiConflictResponse,
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
import { AdjustmentIndexesService } from './adjustment-indexes.service';
import { AdjustmentIndexSummaryQueryDto } from './dto/adjustment-index-summary-query.dto';
import { CreateAdjustmentIndexDto } from './dto/create-adjustment-index.dto';
import { ListAdjustmentIndexesQueryDto } from './dto/list-adjustment-indexes-query.dto';
import { UpdateAdjustmentIndexDto } from './dto/update-adjustment-index.dto';

@ApiTags('adjustment-indexes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/adjustment-indexes')
export class AdjustmentIndexesController {
  constructor(private readonly adjustmentIndexes: AdjustmentIndexesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar um índice de reajuste' })
  @ApiCreatedResponse({ description: 'Índice de reajuste cadastrado.' })
  @ApiConflictResponse({ description: 'Índice já cadastrado no mês.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateAdjustmentIndexDto,
  ) {
    return this.adjustmentIndexes.create(user.id, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar índices de reajuste' })
  @ApiOkResponse({ description: 'Histórico dos índices de reajuste.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListAdjustmentIndexesQueryDto,
  ) {
    return this.adjustmentIndexes.findAll(user.id, propertyId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Consultar o resumo dos reajustes' })
  @ApiOkResponse({ description: 'Resumo composto dos reajustes.' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: AdjustmentIndexSummaryQueryDto,
  ) {
    return this.adjustmentIndexes.summary(user.id, propertyId, query);
  }

  @Get(':adjustmentIndexId')
  @ApiOperation({ summary: 'Consultar um índice de reajuste' })
  @ApiOkResponse({ description: 'Índice de reajuste encontrado.' })
  @ApiNotFoundResponse({ description: 'Índice de reajuste não encontrado.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('adjustmentIndexId', ParseUUIDPipe) adjustmentIndexId: string,
  ) {
    return this.adjustmentIndexes.findOne(
      user.id,
      propertyId,
      adjustmentIndexId,
    );
  }

  @Patch(':adjustmentIndexId')
  @ApiOperation({ summary: 'Atualizar um índice de reajuste' })
  @ApiOkResponse({ description: 'Índice de reajuste atualizado.' })
  @ApiConflictResponse({ description: 'Índice já cadastrado no mês.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('adjustmentIndexId', ParseUUIDPipe) adjustmentIndexId: string,
    @Body() dto: UpdateAdjustmentIndexDto,
  ) {
    return this.adjustmentIndexes.update(
      user.id,
      propertyId,
      adjustmentIndexId,
      dto,
    );
  }

  @Delete(':adjustmentIndexId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir um índice de reajuste' })
  @ApiNoContentResponse({ description: 'Índice de reajuste excluído.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('adjustmentIndexId', ParseUUIDPipe) adjustmentIndexId: string,
  ) {
    return this.adjustmentIndexes.remove(
      user.id,
      propertyId,
      adjustmentIndexId,
    );
  }
}
