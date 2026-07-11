import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquipmentModule } from '../equipment/equipment.module';
import {
  EquipmentHistory,
  EquipmentHistorySchema,
} from './schemas/equipment-history.schema';
import { ReceivingController } from './receiving.controller';
import { ReceivingService } from './receiving.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EquipmentHistory.name, schema: EquipmentHistorySchema },
    ]),
    EquipmentModule,
  ],
  controllers: [ReceivingController],
  providers: [ReceivingService],
  exports: [ReceivingService],
})
export class ReceivingModule {}
