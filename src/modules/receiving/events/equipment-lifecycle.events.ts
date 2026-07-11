import { EquipmentStatus } from '../../equipment/enums/equipment-status.enum';

export const EquipmentEvents = {
  RECEIVED: 'equipment.received',
  INSTALLED: 'equipment.installed',
  STATUS_CHANGED: 'equipment.status-changed',
} as const;

export class EquipmentReceivedEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly assetNumber: string,
    public readonly departmentId: string,
    public readonly registeredBy: string,
  ) {}
}

export class EquipmentInstalledEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly assetNumber: string,
    public readonly departmentId: string,
    public readonly installedBy: string,
  ) {}
}

export class EquipmentStatusChangedEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly assetNumber: string,
    public readonly fromStatus: EquipmentStatus | null,
    public readonly toStatus: EquipmentStatus,
    public readonly changedBy: string,
  ) {}
}
