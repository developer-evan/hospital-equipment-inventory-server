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
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { memoryMulterOptions } from '../../common/utils/multer.util';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentStatus } from './enums/equipment-status.enum';
import { EquipmentService } from './equipment.service';

@ApiTags('Equipment')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @Roles(Role.ADMINISTRATOR, Role.STORE_OFFICER, Role.BIOMEDICAL_ENGINEER)
  create(
    @Body() dto: CreateEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipmentService.create(dto, user.userId as string);
  }

  @Get()
  findAll(
    @Query() query: QueryEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipmentService.findAll(query, user);
  }

  @Get('department/:departmentId')
  findByDepartment(
    @Param('departmentId') departmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipmentService.findByDepartment(departmentId, user);
  }

  @Get('status/:status')
  findByStatus(
    @Param('status') status: EquipmentStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipmentService.findByStatus(status, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipmentService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipmentService.update(id, dto, user.userId as string);
  }

  @Delete(':id')
  @Roles(Role.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.equipmentService.softDelete(id, user.userId as string);
  }

  @Post(':id/photos')
  @Roles(Role.ADMINISTRATOR, Role.STORE_OFFICER, Role.BIOMEDICAL_ENGINEER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 10, memoryMulterOptions()))
  uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() photos: Array<Express.Multer.File>,
  ) {
    return this.equipmentService.uploadPhotos(id, photos);
  }

  @Post(':id/manual')
  @Roles(Role.ADMINISTRATOR, Role.STORE_OFFICER, Role.BIOMEDICAL_ENGINEER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('manual', memoryMulterOptions()))
  uploadManual(
    @Param('id') id: string,
    @UploadedFile() manual: Express.Multer.File,
  ) {
    return this.equipmentService.uploadManual(id, manual);
  }

  @Post(':id/qr-code/regenerate')
  @Roles(Role.ADMINISTRATOR, Role.BIOMEDICAL_ENGINEER)
  regenerateQrCode(@Param('id') id: string) {
    return this.equipmentService.regenerateQrCode(id);
  }

  @Get(':id/qr-code')
  async getQrCode(@Param('id') id: string) {
    const equipment = await this.equipmentService.findById(id);
    return { qrCodeUrl: equipment.qrCodeUrl };
  }
}
