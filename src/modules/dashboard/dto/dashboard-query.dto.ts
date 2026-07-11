import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict the summary to a single department',
  })
  @IsOptional()
  @IsMongoId()
  department?: string;
}
