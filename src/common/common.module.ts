import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { SequenceService } from './utils/sequence.service';

/**
 * Shared, side-effect-free utilities (currently: the atomic sequence
 * generator) used across multiple domain modules. Import wherever
 * `SequenceService` is needed.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }]),
  ],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class CommonModule {}
