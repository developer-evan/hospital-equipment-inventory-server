import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  buildPaginationMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { EquipmentStatus } from '../equipment/enums/equipment-status.enum';
import { EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { EquipmentService } from '../equipment/equipment.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ConfirmInstallationDto } from './dto/confirm-installation.dto';
import { RegisterEquipmentDto } from './dto/register-equipment.dto';
import {
  EquipmentEvents,
  EquipmentInstalledEvent,
  EquipmentReceivedEvent,
  EquipmentStatusChangedEvent,
} from './events/equipment-lifecycle.events';
import {
  EquipmentHistory,
  EquipmentHistoryDocument,
} from './schemas/equipment-history.schema';

/**
 * Legal lifecycle transitions (see plan's state diagram). Anything not
 * listed here is rejected with a 400.
 */
const ALLOWED_TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  [EquipmentStatus.PENDING_INSTALLATION]: [EquipmentStatus.WORKING],
  [EquipmentStatus.WORKING]: [
    EquipmentStatus.UNDER_REPAIR,
    EquipmentStatus.CONDEMNED,
    EquipmentStatus.DECOMMISSIONED,
  ],
  [EquipmentStatus.UNDER_REPAIR]: [
    EquipmentStatus.WORKING,
    EquipmentStatus.CONDEMNED,
  ],
  [EquipmentStatus.CONDEMNED]: [EquipmentStatus.DECOMMISSIONED],
  [EquipmentStatus.DECOMMISSIONED]: [],
};

@Injectable()
export class ReceivingService {
  constructor(
    @InjectModel(EquipmentHistory.name)
    private readonly historyModel: Model<EquipmentHistoryDocument>,
    private readonly equipmentService: EquipmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async registerIncoming(
    dto: RegisterEquipmentDto,
    actorId: string,
  ): Promise<EquipmentDocument> {
    const equipment = await this.equipmentService.create(
      { ...dto, status: EquipmentStatus.PENDING_INSTALLATION },
      actorId,
    );

    await this.recordTransition(
      equipment.id,
      null,
      EquipmentStatus.PENDING_INSTALLATION,
      actorId,
      'Registered by store officer',
    );

    this.eventEmitter.emit(
      EquipmentEvents.RECEIVED,
      new EquipmentReceivedEvent(
        equipment.id,
        equipment.assetNumber,
        equipment.department.toString(),
        actorId,
      ),
    );

    return equipment;
  }

  async confirmInstallation(
    equipmentId: string,
    dto: ConfirmInstallationDto,
    actorId: string,
  ): Promise<EquipmentDocument> {
    const equipment = await this.equipmentService.findById(equipmentId);
    this.assertTransitionAllowed(equipment.status, EquipmentStatus.WORKING);

    const previousStatus = equipment.status;
    equipment.status = EquipmentStatus.WORKING;
    equipment.installationDate = dto.installationDate
      ? new Date(dto.installationDate)
      : new Date();
    equipment.installedBy = new Types.ObjectId(actorId);
    equipment.updatedBy = new Types.ObjectId(actorId);
    await equipment.save();

    await this.recordTransition(
      equipment.id,
      previousStatus,
      EquipmentStatus.WORKING,
      actorId,
      dto.note ?? 'Installation confirmed by engineer',
    );

    this.eventEmitter.emit(
      EquipmentEvents.INSTALLED,
      new EquipmentInstalledEvent(
        equipment.id,
        equipment.assetNumber,
        equipment.department.toString(),
        actorId,
      ),
    );

    return equipment;
  }

  async changeStatus(
    equipmentId: string,
    dto: ChangeStatusDto,
    actorId: string,
  ): Promise<EquipmentDocument> {
    const equipment = await this.equipmentService.findById(equipmentId);
    this.assertTransitionAllowed(equipment.status, dto.toStatus);

    const previousStatus = equipment.status;
    equipment.status = dto.toStatus;
    equipment.updatedBy = new Types.ObjectId(actorId);
    await equipment.save();

    await this.recordTransition(
      equipment.id,
      previousStatus,
      dto.toStatus,
      actorId,
      dto.note,
    );

    this.eventEmitter.emit(
      EquipmentEvents.STATUS_CHANGED,
      new EquipmentStatusChangedEvent(
        equipment.id,
        equipment.assetNumber,
        previousStatus,
        dto.toStatus,
        actorId,
      ),
    );

    return equipment;
  }

  async getHistory(
    equipmentId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<EquipmentHistoryDocument>> {
    const filter = { equipment: new Types.ObjectId(equipmentId) };
    const [items, totalItems] = await Promise.all([
      this.historyModel
        .find(filter)
        .populate('changedBy', 'username fullName')
        .sort({ changedAt: -1 })
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.historyModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as EquipmentHistoryDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  private async recordTransition(
    equipmentId: string,
    fromStatus: EquipmentStatus | null,
    toStatus: EquipmentStatus,
    actorId: string,
    note?: string,
  ): Promise<void> {
    await this.historyModel.create({
      equipment: new Types.ObjectId(equipmentId),
      fromStatus,
      toStatus,
      changedBy: new Types.ObjectId(actorId),
      changedAt: new Date(),
      note,
    });
  }

  private assertTransitionAllowed(
    from: EquipmentStatus,
    to: EquipmentStatus,
  ): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition equipment from ${from} to ${to}`,
      );
    }
  }
}
