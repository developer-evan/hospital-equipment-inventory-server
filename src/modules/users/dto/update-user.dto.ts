import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ description: 'Toggle account activation' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
