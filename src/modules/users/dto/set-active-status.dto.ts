import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
