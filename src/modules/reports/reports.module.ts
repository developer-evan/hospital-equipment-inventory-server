import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Equipment,
  EquipmentSchema,
} from '../equipment/schemas/equipment.schema';
import {
  Maintenance,
  MaintenanceSchema,
} from '../maintenance/schemas/maintenance.schema';
import { ExcelReportGenerator } from './generators/excel-report.generator';
import { PdfReportGenerator } from './generators/pdf-report.generator';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExcelReportGenerator, PdfReportGenerator],
})
export class ReportsModule {}
