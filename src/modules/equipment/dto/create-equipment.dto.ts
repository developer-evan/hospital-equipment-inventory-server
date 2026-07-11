import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EquipmentStatus } from '../enums/equipment-status.enum';

export class CreateEquipmentDto {
  @ApiPropertyOptional({
    description: 'Leave blank to auto-generate a sequential asset number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assetNumber?: string;

  @ApiProperty({ example: 'Patient Monitor' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Diagnostic Imaging' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 'Philips' })
  @IsString()
  @MaxLength(100)
  manufacturer: string;

  @ApiPropertyOptional({ example: 'IntelliVue MX450' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiProperty({ example: 'SN-00012345' })
  @IsString()
  @MaxLength(100)
  serialNumber: string;

  @ApiProperty({ description: 'Department ID this equipment belongs to' })
  @IsMongoId()
  department: string;

  @ApiPropertyOptional({ example: 'Room 4, ICU' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  roomLocation?: string;

  @ApiPropertyOptional({ example: 'MedSupplies Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional({
    default: 90,
    description: 'Preventive maintenance cycle, in days',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  pmFrequencyDays?: number;

  @ApiPropertyOptional({
    default: 365,
    description: 'Calibration cycle, in days',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  calibrationFrequencyDays?: number;
}
