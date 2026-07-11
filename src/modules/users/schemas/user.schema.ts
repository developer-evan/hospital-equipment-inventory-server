import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { BaseSchema } from '../../../common/schemas/base.schema';
import { softDeletePlugin } from '../../../common/schemas/soft-delete.plugin';
import { Role } from '../../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'Department' }],
    default: [],
  })
  departments: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(softDeletePlugin);
UserSchema.index({ role: 1 });
// username/email already get a unique index from `@Prop({ unique: true })`.
