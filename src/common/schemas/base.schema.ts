import { Prop } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

/**
 * Shared audit + soft-delete fields for every domain collection.
 * Concrete schemas extend this class so Mongoose picks up the props
 * via `@Schema()` + `SchemaFactory.createForClass`.
 *
 * Note: `type: SchemaTypes.ObjectId` (i.e. `Schema.Types.ObjectId`, the
 * schema-type class) is required here — `Types.ObjectId` (the BSON
 * value class used to *construct* ids, e.g. `new Types.ObjectId()`) is
 * a distinct class and is not recognized by Mongoose's schema
 * compiler, which silently falls back to an uncast `Mixed` type.
 */
export abstract class BaseSchema {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}
