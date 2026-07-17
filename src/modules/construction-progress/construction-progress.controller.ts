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
import { CreateConstructionProgressDto } from './dto/create-construction-progress.dto';
import { ListConstructionProgressQueryDto } from './dto/list-construction-progress-query.dto';
import { UpdateConstructionProgressDto } from './dto/update-construction-progress.dto';
import { ConstructionProgressService } from './construction-progress.service';

@ApiTags('construction-progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/construction-progress')
export class ConstructionProgressController {
  constructor(private readonly progress: ConstructionProgressService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar uma atualização da obra' })
  @ApiCreatedResponse({ description: 'Atualização cadastrada.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateConstructionProgressDto,
  ) {
    return this.progress.create(user.id, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar a evolução da obra' })
  @ApiOkResponse({ description: 'Histórico da evolução da obra.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListConstructionProgressQueryDto,
  ) {
    return this.progress.findAll(user.id, propertyId, query);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Consultar a atualização mais recente' })
  @ApiOkResponse({ description: 'Atualização mais recente e diferença.' })
  @ApiNotFoundResponse({ description: 'Atualização não encontrada.' })
  latest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.progress.latest(user.id, propertyId);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Comparar evolução realizada e prevista' })
  @ApiOkResponse({ description: 'Série cronológica para o gráfico.' })
  comparison(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.progress.comparison(user.id, propertyId);
  }

  @Get(':progressId')
  @ApiOperation({ summary: 'Consultar uma atualização da obra' })
  @ApiOkResponse({ description: 'Atualização encontrada.' })
  @ApiNotFoundResponse({ description: 'Atualização não encontrada.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('progressId', ParseUUIDPipe) progressId: string,
  ) {
    return this.progress.findOne(user.id, propertyId, progressId);
  }

  @Patch(':progressId')
  @ApiOperation({ summary: 'Atualizar um registro de evolução da obra' })
  @ApiOkResponse({ description: 'Atualização alterada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('progressId', ParseUUIDPipe) progressId: string,
    @Body() dto: UpdateConstructionProgressDto,
  ) {
    return this.progress.update(user.id, propertyId, progressId, dto);
  }

  @Delete(':progressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir um registro de evolução da obra' })
  @ApiNoContentResponse({ description: 'Atualização excluída.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('progressId', ParseUUIDPipe) progressId: string,
  ) {
    return this.progress.remove(user.id, propertyId, progressId);
  }
}
