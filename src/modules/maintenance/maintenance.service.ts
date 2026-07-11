import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { isDepartmentScopedUser } from '../../common/utils/department-scope.util';
import { EquipmentService } from '../equipment/equipment.service';
import { CompleteMaintenanceDto } from './dto/complete-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { QueryMaintenanceDto } from './dto/query-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceStatus } from './enums/maintenance-status.enum';
import { MaintenanceType } from './enums/maintenance-type.enum';
import {
  MaintenanceCompletedEvent,
  MaintenanceEvents,
} from './events/maintenance.events';
import { Maintenance, MaintenanceDocument } from './schemas/maintenance.schema';

const RECURRING_TYPES = [
  MaintenanceType.PREVENTIVE,
  MaintenanceType.CALIBRATION,
];

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<MaintenanceDocument>,
    private readonly equipmentService: EquipmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    dto: CreateMaintenanceDto,
    actorId?: string,
  ): Promise<MaintenanceDocument> {
    const equipment = await this.equipmentService.findById(dto.equipment);

    const status = dto.performedDate
      ? MaintenanceStatus.COMPLETED
      : MaintenanceStatus.SCHEDULED;
    const nextDueDate =
      RECURRING_TYPES.includes(dto.type) && dto.scheduledDate
        ? this.computeNextDueDate(
            equipment,
            dto.type,
            new Date(dto.scheduledDate),
          )
        : undefined;

    const record = await this.maintenanceModel.create({
      ...dto,
      status,
      nextDueDate,
      createdBy: actorId,
    });

    return record;
  }

  async findAll(
    query: QueryMaintenanceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<MaintenanceDocument>> {
    const filter = await this.buildListFilter(query, user);
    return this.paginate(filter, query);
  }

  async findHistoryForEquipment(
    equipmentId: string,
  ): Promise<MaintenanceDocument[]> {
    return this.maintenanceModel
      .find({ equipment: new Types.ObjectId(equipmentId) })
      .populate('engineer', 'username fullName')
      .sort({ createdAt: -1 })
      .lean();
  }

  /** Calendar-style PM/calibration schedule: upcoming SCHEDULED (+ OVERDUE) records. */
  async getSchedule(
    query: QueryMaintenanceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<MaintenanceDocument>> {
    const filter = await this.buildListFilter(query, user);
    if (!query.status) {
      filter.status = {
        $in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.OVERDUE],
      };
    }
    return this.paginate(filter, query);
  }

  async findById(id: string): Promise<MaintenanceDocument> {
    const record = await this.maintenanceModel
      .findById(id)
      .populate('equipment', 'assetNumber name department')
      .populate('engineer', 'username fullName');
    if (!record) {
      throw new NotFoundException(`Maintenance record ${id} not found`);
    }
    return record;
  }

  async update(
    id: string,
    dto: UpdateMaintenanceDto,
    actorId?: string,
  ): Promise<MaintenanceDocument> {
    const record = await this.maintenanceModel.findByIdAndUpdate(
      id,
      { ...dto, updatedBy: actorId },
      { new: true },
    );
    if (!record) {
      throw new NotFoundException(`Maintenance record ${id} not found`);
    }
    return record;
  }

  async markComplete(
    id: string,
    dto: CompleteMaintenanceDto,
    actorId: string,
  ): Promise<MaintenanceDocument> {
    const record = await this.findById(id);
    if (record.status === MaintenanceStatus.COMPLETED) {
      throw new BadRequestException(
        'This maintenance record is already completed',
      );
    }

    record.status = MaintenanceStatus.COMPLETED;
    record.performedDate = dto.performedDate
      ? new Date(dto.performedDate)
      : new Date();
    if (dto.serviceReport) record.serviceReport = dto.serviceReport;
    if (dto.spareParts) record.spareParts = dto.spareParts;
    record.updatedBy = new Types.ObjectId(actorId);
    await record.save();

    this.eventEmitter.emit(
      MaintenanceEvents.COMPLETED,
      new MaintenanceCompletedEvent(
        record.id,
        record.equipment.toString(),
        record.type,
        actorId,
      ),
    );

    if (RECURRING_TYPES.includes(record.type)) {
      await this.scheduleNextOccurrence(record);
    }

    return record;
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const result = await this.maintenanceModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    if (!result) {
      throw new NotFoundException(`Maintenance record ${id} not found`);
    }
  }

  /** Flips SCHEDULED records whose scheduledDate has passed to OVERDUE. Invoked by the notifications module's daily cron. */
  async markOverdueRecords(): Promise<number> {
    const result = await this.maintenanceModel.updateMany(
      {
        status: MaintenanceStatus.SCHEDULED,
        scheduledDate: { $lt: new Date() },
      },
      { status: MaintenanceStatus.OVERDUE },
    );
    return result.modifiedCount;
  }

  async findDueWithinDays(days: number): Promise<MaintenanceDocument[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return this.maintenanceModel
      .find({
        status: {
          $in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.OVERDUE],
        },
        scheduledDate: { $lte: threshold },
      })
      .populate('equipment', 'assetNumber name department')
      .populate('engineer', 'username fullName')
      .lean();
  }

  private async buildListFilter(
    query: QueryMaintenanceDto,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    if (query.equipment) filter.equipment = new Types.ObjectId(query.equipment);
    if (query.engineer) filter.engineer = new Types.ObjectId(query.engineer);
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.scheduledDate = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    await this.applyDepartmentScope(filter, user, query.equipment);
    return filter;
  }

  private async paginate(
    filter: Record<string, unknown>,
    query: QueryMaintenanceDto,
  ): Promise<PaginatedResult<MaintenanceDocument>> {
    const [items, totalItems] = await Promise.all([
      this.maintenanceModel
        .find(filter)
        .populate('equipment', 'assetNumber name department')
        .populate('engineer', 'username fullName')
        .sort(query.sortObject)
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.maintenanceModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as MaintenanceDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  private async scheduleNextOccurrence(
    record: MaintenanceDocument,
  ): Promise<void> {
    // `record.equipment` may be a plain ObjectId or a populated document
    // (e.g. when `record` comes from a query that used `.populate()`).
    const equipmentRef: unknown = record.equipment;
    const equipmentId =
      equipmentRef && typeof equipmentRef === 'object' && '_id' in equipmentRef
        ? String((equipmentRef as { _id: Types.ObjectId })._id)
        : String(equipmentRef);
    const equipment = await this.equipmentService.findById(equipmentId);
    const baseDate = record.performedDate ?? new Date();
    const nextDueDate = this.computeNextDueDate(
      equipment,
      record.type,
      baseDate,
    );

    await this.maintenanceModel.create({
      equipment: equipmentId,
      type: record.type,
      scheduledDate: nextDueDate,
      nextDueDate,
      status: MaintenanceStatus.SCHEDULED,
      createdBy: record.updatedBy,
    });
  }

  private computeNextDueDate(
    equipment: { pmFrequencyDays: number; calibrationFrequencyDays: number },
    type: MaintenanceType,
    fromDate: Date,
  ): Date {
    const frequencyDays =
      type === MaintenanceType.CALIBRATION
        ? equipment.calibrationFrequencyDays
        : equipment.pmFrequencyDays;
    const next = new Date(fromDate);
    next.setDate(next.getDate() + frequencyDays);
    return next;
  }

  private async applyDepartmentScope(
    filter: Record<string, unknown>,
    user: AuthenticatedUser,
    explicitEquipmentId?: string,
  ): Promise<void> {
    if (explicitEquipmentId || !isDepartmentScopedUser(user)) {
      // A specific equipment filter is trusted as-is; unscoped roles
      // (admin/store officer) see every record without narrowing.
      return;
    }
    const scopedIds = await this.equipmentService.findScopedIds(user);
    filter.equipment = { $in: scopedIds };
  }
}
