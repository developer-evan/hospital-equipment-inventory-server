import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { EquipmentStatus } from '../../equipment/enums/equipment-status.enum';
import type { ReportFormat } from '../reports.types';

export class ReportFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  department?: string;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  engineer?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['excel', 'pdf'], default: 'excel' })
  @IsOptional()
  @IsIn(['excel', 'pdf'])
  format?: ReportFormat = 'excel';
}
