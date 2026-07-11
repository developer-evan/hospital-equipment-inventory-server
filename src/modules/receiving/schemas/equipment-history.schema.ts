import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { EquipmentStatus } from '../../equipment/enums/equipment-status.enum';

export type EquipmentHistoryDocument = HydratedDocument<EquipmentHistory>;

/**
 * One row per lifecycle transition. Kept as its own collection (rather
 * than an embedded array on Equipment) so history can grow and be
 * paginated/queried independently of the equipment document.
 */
@Schema({ timestamps: true })
export class EquipmentHistory {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Equipment',
    required: true,
    index: true,
  })
  equipment: Types.ObjectId;

  @Prop({ type: String, enum: EquipmentStatus, default: null })
  fromStatus: EquipmentStatus | null;

  @Prop({ type: String, enum: EquipmentStatus, required: true })
  toStatus: EquipmentStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  changedBy: Types.ObjectId;

  @Prop({ default: Date.now })
  changedAt: Date;

  @Prop({ trim: true })
  note?: string;
}

export const EquipmentHistorySchema =
  SchemaFactory.createForClass(EquipmentHistory);
EquipmentHistorySchema.index({ equipment: 1, changedAt: -1 });
