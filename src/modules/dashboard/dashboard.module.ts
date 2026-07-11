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
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
