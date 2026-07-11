import { OmitType } from '@nestjs/swagger';
import { CreateEquipmentDto } from '../../equipment/dto/create-equipment.dto';

/** Store Officer intake form — status is always forced to PENDING_INSTALLATION. */
export class RegisterEquipmentDto extends OmitType(CreateEquipmentDto, [
  'status',
] as const) {}
