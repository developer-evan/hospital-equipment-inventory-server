import { MaintenanceType } from '../enums/maintenance-type.enum';

export const MaintenanceEvents = {
  COMPLETED: 'maintenance.completed',
  OVERDUE: 'maintenance.overdue',
} as const;

export class MaintenanceCompletedEvent {
  constructor(
    public readonly maintenanceId: string,
    public readonly equipmentId: string,
    public readonly type: MaintenanceType,
    public readonly completedBy: string,
  ) {}
}

export class MaintenanceOverdueEvent {
  constructor(
    public readonly maintenanceId: string,
    public readonly equipmentId: string,
    public readonly type: MaintenanceType,
  ) {}
}
