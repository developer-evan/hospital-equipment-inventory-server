import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../modules/departments/departments.module';
import { UsersModule } from '../modules/users/users.module';
import { SeedService } from './seed.service';

@Module({
  imports: [UsersModule, DepartmentsModule],
  providers: [SeedService],
})
export class SeedModule {}
