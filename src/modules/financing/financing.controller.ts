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
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';
import { FinancingService } from './financing.service';

@ApiTags('financing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/financing')
export class FinancingController {
  constructor(private readonly financing: FinancingService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar o financiamento de um imóvel' })
  @ApiCreatedResponse({ description: 'Financiamento cadastrado.' })
  @ApiConflictResponse({ description: 'O imóvel já possui financiamento.' })
  @ApiNotFoundResponse({ description: 'Imóvel não encontrado.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateFinancingDto,
  ) {
    return this.financing.create(user.id, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar o financiamento de um imóvel' })
  @ApiOkResponse({ description: 'Financiamento encontrado.' })
  @ApiNotFoundResponse({ description: 'Financiamento não encontrado.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.financing.findOne(user.id, propertyId);
  }

  @Patch()
  @ApiOperation({ summary: 'Atualizar o financiamento de um imóvel' })
  @ApiOkResponse({ description: 'Financiamento atualizado.' })
  @ApiNotFoundResponse({ description: 'Financiamento não encontrado.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdateFinancingDto,
  ) {
    return this.financing.update(user.id, propertyId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir o financiamento de um imóvel' })
  @ApiNoContentResponse({ description: 'Financiamento excluído.' })
  @ApiNotFoundResponse({ description: 'Financiamento não encontrado.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.financing.remove(user.id, propertyId);
  }
}
