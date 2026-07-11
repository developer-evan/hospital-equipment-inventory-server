import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ConfirmInstallationDto } from './dto/confirm-installation.dto';
import { RegisterEquipmentDto } from './dto/register-equipment.dto';
import { ReceivingService } from './receiving.service';

@ApiTags('Receiving')
@ApiBearerAuth()
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Post('register')
  @Roles(Role.ADMINISTRATOR, Role.STORE_OFFICER)
  register(
    @Body() dto: RegisterEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receivingService.registerIncoming(dto, user.userId as string);
  }

  @Patch(':equipmentId/confirm-installation')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  confirmInstallation(
    @Param('equipmentId') equipmentId: string,
    @Body() dto: ConfirmInstallationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receivingService.confirmInstallation(
      equipmentId,
      dto,
      user.userId as string,
    );
  }

  @Patch(':equipmentId/status')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  changeStatus(
    @Param('equipmentId') equipmentId: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receivingService.changeStatus(
      equipmentId,
      dto,
      user.userId as string,
    );
  }

  @Get(':equipmentId/history')
  getHistory(
    @Param('equipmentId') equipmentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.receivingService.getHistory(equipmentId, query);
  }
}
