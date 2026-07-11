import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { memoryMulterOptions } from '../../common/utils/multer.util';
import { ALLOWED_IMAGE_MIME_TYPES } from '../files/files.constants';
import { FilesService } from '../files/files.service';
import { CompleteMaintenanceDto } from './dto/complete-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { QueryMaintenanceDto } from './dto/query-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  create(
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.create(dto, user.userId as string);
  }

  @Get()
  findAll(
    @Query() query: QueryMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.findAll(query, user);
  }

  @Get('schedule')
  getSchedule(
    @Query() query: QueryMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.getSchedule(query, user);
  }

  @Get('equipment/:equipmentId/history')
  getHistoryForEquipment(@Param('equipmentId') equipmentId: string) {
    return this.maintenanceService.findHistoryForEquipment(equipmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.update(id, dto, user.userId as string);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  markComplete(
    @Param('id') id: string,
    @Body() dto: CompleteMaintenanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.markComplete(id, dto, user.userId as string);
  }

  @Post(':id/photos')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 10, memoryMulterOptions()))
  async uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() photos: Array<Express.Multer.File>,
  ) {
    const refs = await this.filesService.uploadMany(
      photos,
      'maintenance-photos',
      ALLOWED_IMAGE_MIME_TYPES,
    );
    const record = await this.maintenanceService.findById(id);
    record.photoUrls.push(...refs.map((r) => r.url));
    await record.save();
    return record;
  }

  @Delete(':id')
  @Roles(Role.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.softDelete(id, user.userId as string);
  }
}
