import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { softDeletePlugin } from '../../../common/schemas/soft-delete.plugin';
import { MaintenanceStatus } from '../enums/maintenance-status.enum';
import { MaintenanceType } from '../enums/maintenance-type.enum';

export type MaintenanceDocument = HydratedDocument<Maintenance>;

@Schema({ _id: false })
export class SparePartUsed {
  @Prop({ required: true, trim: true })
  partName: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  cost: number;
}
export const SparePartUsedSchema = SchemaFactory.createForClass(SparePartUsed);

/**
 * Single collection for PREVENTIVE / CORRECTIVE / CALIBRATION records —
 * the fields overlap heavily and cross-type queries (engineer
 * workload, calendar view) are far simpler against one collection.
 * Type-specific validation (e.g. `scheduledDate` required for
 * PREVENTIVE/CALIBRATION) is enforced in the DTO/service layer.
 */
@Schema({ timestamps: true })
export class Maintenance extends BaseSchema {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Equipment',
    required: true,
    index: true,
  })
  equipment: Types.ObjectId;

  @Prop({ type: String, enum: MaintenanceType, required: true })
  type: MaintenanceType;

  @Prop()
  scheduledDate?: Date;

  @Prop()
  performedDate?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  engineer?: Types.ObjectId;

  @Prop({ type: [SparePartUsedSchema], default: [] })
  spareParts: SparePartUsed[];

  @Prop({ trim: true })
  serviceReport?: string;

  @Prop({ type: [String], default: [] })
  photoUrls: string[];

  @Prop({
    type: String,
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  @Prop()
  nextDueDate?: Date;
}

export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
MaintenanceSchema.plugin(softDeletePlugin);
MaintenanceSchema.index({ equipment: 1, type: 1 });
MaintenanceSchema.index({ status: 1, scheduledDate: 1 });
MaintenanceSchema.index({ engineer: 1 });
