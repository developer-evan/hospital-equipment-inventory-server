import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { buildDepartmentFilter } from '../../common/utils/department-scope.util';
import { generateQrCodePng } from '../../common/utils/qrcode.util';
import { SequenceService } from '../../common/utils/sequence.service';
import { FilesService, MulterFileLike } from '../files/files.service';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
} from '../files/files.constants';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentStatus } from './enums/equipment-status.enum';
import { Equipment, EquipmentDocument } from './schemas/equipment.schema';

const ASSET_NUMBER_COUNTER = 'equipment-asset-number';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    private readonly sequenceService: SequenceService,
    private readonly filesService: FilesService,
  ) {}

  async create(
    dto: CreateEquipmentDto,
    actorId?: string,
  ): Promise<EquipmentDocument> {
    await this.assertUnique(undefined, dto.serialNumber, dto.assetNumber);

    const assetNumber = dto.assetNumber ?? (await this.generateAssetNumber());

    const equipment = new this.equipmentModel({
      ...dto,
      assetNumber,
      status: dto.status ?? EquipmentStatus.PENDING_INSTALLATION,
      createdBy: actorId,
    });
    await equipment.save();

    await this.attachQrCode(equipment);
    return equipment;
  }

  async findAll(
    query: QueryEquipmentDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<EquipmentDocument>> {
    const filter: Record<string, unknown> = { ...buildDepartmentFilter(user) };

    if (query.department)
      filter.department = new Types.ObjectId(query.department);
    if (query.status) filter.status = query.status;
    if (query.category)
      filter.category = { $regex: query.category, $options: 'i' };
    if (query.search) filter.$text = { $search: query.search };

    const [items, totalItems] = await Promise.all([
      this.equipmentModel
        .find(filter)
        .populate('department', 'name code')
        .sort(query.sortObject)
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.equipmentModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as EquipmentDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  async findByDepartment(
    departmentId: string,
    user: AuthenticatedUser,
  ): Promise<EquipmentDocument[]> {
    const filter = {
      ...buildDepartmentFilter(user),
      department: new Types.ObjectId(departmentId),
      status: { $ne: EquipmentStatus.PENDING_INSTALLATION },
    };
    return this.equipmentModel
      .find(filter)
      .populate('department', 'name code')
      .lean();
  }

  async findByStatus(
    status: EquipmentStatus,
    user: AuthenticatedUser,
  ): Promise<EquipmentDocument[]> {
    const filter = { ...buildDepartmentFilter(user), status };
    return this.equipmentModel
      .find(filter)
      .populate('department', 'name code')
      .lean();
  }

  async findById(id: string): Promise<EquipmentDocument> {
    const equipment = await this.equipmentModel
      .findById(id)
      .populate('department', 'name code');
    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
    return equipment;
  }

  async update(
    id: string,
    dto: UpdateEquipmentDto,
    actorId?: string,
  ): Promise<EquipmentDocument> {
    if (dto.serialNumber || dto.assetNumber) {
      await this.assertUnique(id, dto.serialNumber, dto.assetNumber);
    }
    const equipment = await this.equipmentModel.findByIdAndUpdate(
      id,
      { ...dto, updatedBy: actorId },
      { new: true },
    );
    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
    return equipment;
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const result = await this.equipmentModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    if (!result) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
  }

  async uploadPhotos(
    id: string,
    files: MulterFileLike[],
  ): Promise<EquipmentDocument> {
    const equipment = await this.findById(id);
    const refs = await this.filesService.uploadMany(
      files,
      'equipment-photos',
      ALLOWED_IMAGE_MIME_TYPES,
    );
    equipment.photoUrls.push(...refs.map((r) => r.url));
    await equipment.save();
    return equipment;
  }

  async uploadManual(
    id: string,
    file: MulterFileLike,
  ): Promise<EquipmentDocument> {
    const equipment = await this.findById(id);
    const ref = await this.filesService.uploadOne(
      file,
      'equipment-manuals',
      ALLOWED_DOCUMENT_MIME_TYPES,
    );
    equipment.manualUrls.push(ref.url);
    await equipment.save();
    return equipment;
  }

  async regenerateQrCode(id: string): Promise<EquipmentDocument> {
    const equipment = await this.findById(id);
    await this.attachQrCode(equipment);
    return equipment;
  }

  private async attachQrCode(equipment: EquipmentDocument): Promise<void> {
    const payload = `${equipment.assetNumber}:${equipment.id}`;
    const png = await generateQrCodePng(payload);
    const ref = await this.filesService.uploadOne(
      {
        buffer: png,
        originalname: `${equipment.assetNumber}-qr.png`,
        mimetype: 'image/png',
      },
      'qr-codes',
      ['image/png'],
    );
    equipment.qrCodeUrl = ref.url;
    await equipment.save();
  }

  private async generateAssetNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.sequenceService.next(
      `${ASSET_NUMBER_COUNTER}-${year}`,
    );
    return `EQ-${year}-${seq.toString().padStart(5, '0')}`;
  }

  async findWarrantyExpiringWithinDays(
    days: number,
  ): Promise<EquipmentDocument[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return this.equipmentModel
      .find({ warrantyEndDate: { $gte: new Date(), $lte: threshold } })
      .populate('department', 'name code')
      .lean();
  }

  /** Equipment IDs visible to the given user under department scoping — used by other modules (Maintenance, Reports, Dashboard) to join without duplicating the scoping rule. */
  async findScopedIds(user: AuthenticatedUser): Promise<Types.ObjectId[]> {
    const filter = buildDepartmentFilter(user);
    const docs = await this.equipmentModel.find(filter).select('_id').lean();
    return docs.map((d) => d._id);
  }

  private async assertUnique(
    excludeId?: string,
    serialNumber?: string,
    assetNumber?: string,
  ): Promise<void> {
    const orConditions: Record<string, unknown>[] = [];
    if (serialNumber) orConditions.push({ serialNumber });
    if (assetNumber) orConditions.push({ assetNumber });
    if (orConditions.length === 0) return;

    const filter: Record<string, unknown> = { $or: orConditions };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const existing = await this.equipmentModel.findOne(filter);
    if (existing) {
      throw new ConflictException(
        'Equipment with this asset number or serial number already exists',
      );
    }
  }
}
