import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { softDeletePlugin } from '../../../common/schemas/soft-delete.plugin';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department extends BaseSchema {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.plugin(softDeletePlugin);
// name/code already get a unique index from `@Prop({ unique: true })`.
