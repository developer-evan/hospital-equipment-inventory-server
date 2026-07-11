import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

/**
 * Generic atomic sequence generator (e.g. `asset-number-2026`) used to
 * mint human-friendly, sequential codes without race conditions —
 * `findOneAndUpdate` with `$inc` is atomic at the MongoDB level.
 */
@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ required: true })
  _id: string;

  @Prop({ default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
