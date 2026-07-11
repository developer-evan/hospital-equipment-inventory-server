import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MaintenanceType } from '../enums/maintenance-type.enum';
import { SparePartUsedDto } from './spare-part-used.dto';

export class CreateMaintenanceDto {
  @ApiProperty({ description: 'Equipment ID this maintenance record is for' })
  @IsMongoId()
  equipment: string;

  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiPropertyOptional({
    description:
      'Required for PREVENTIVE / CALIBRATION; the planned date of service',
  })
  @ValidateIf(
    (dto: CreateMaintenanceDto) => dto.type !== MaintenanceType.CORRECTIVE,
  )
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({
    description: 'Set when work has actually been carried out',
  })
  @IsOptional()
  @IsDateString()
  performedDate?: string;

  @ApiPropertyOptional({
    description: 'Engineer user ID who serviced the equipment',
  })
  @IsOptional()
  @IsMongoId()
  engineer?: string;

  @ApiPropertyOptional({ type: [SparePartUsedDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SparePartUsedDto)
  spareParts?: SparePartUsedDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceReport?: string;
}
