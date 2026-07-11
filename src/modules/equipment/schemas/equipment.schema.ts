import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { softDeletePlugin } from '../../../common/schemas/soft-delete.plugin';
import { EquipmentStatus } from '../enums/equipment-status.enum';

export type EquipmentDocument = HydratedDocument<Equipment>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Equipment extends BaseSchema {
  @Prop({ required: true, unique: true, trim: true })
  assetNumber: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  manufacturer: string;

  @Prop({ trim: true })
  model?: string;

  @Prop({ required: true, unique: true, trim: true })
  serialNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Department', required: true })
  department: Types.ObjectId;

  @Prop({ trim: true })
  roomLocation?: string;

  @Prop({ trim: true })
  supplier?: string;

  @Prop()
  purchaseDate?: Date;

  @Prop()
  installationDate?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  installedBy?: Types.ObjectId;

  @Prop()
  warrantyStartDate?: Date;

  @Prop()
  warrantyEndDate?: Date;

  @Prop()
  cost?: number;

  @Prop({
    type: String,
    enum: EquipmentStatus,
    default: EquipmentStatus.PENDING_INSTALLATION,
  })
  status: EquipmentStatus;

  @Prop({ type: [String], default: [] })
  photoUrls: string[];

  @Prop({ type: [String], default: [] })
  manualUrls: string[];

  @Prop()
  qrCodeUrl?: string;

  @Prop({ default: 90 })
  pmFrequencyDays: number;

  @Prop({ default: 365 })
  calibrationFrequencyDays: number;
}

export const EquipmentSchema = SchemaFactory.createForClass(Equipment);
EquipmentSchema.plugin(softDeletePlugin);

// assetNumber/serialNumber already get a unique index from `@Prop({ unique: true })`.
EquipmentSchema.index({ department: 1, status: 1 });
EquipmentSchema.index({ name: 'text', category: 'text', manufacturer: 'text' });

/** Computed, not stored — avoids drift if the warranty end date changes. */
EquipmentSchema.virtual('isWarrantyExpired').get(function (
  this: EquipmentDocument,
) {
  return this.warrantyEndDate
    ? this.warrantyEndDate.getTime() < Date.now()
    : false;
});
