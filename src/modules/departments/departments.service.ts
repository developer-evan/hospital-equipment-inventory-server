import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  buildPaginationMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department, DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async create(
    dto: CreateDepartmentDto,
    actorId?: string,
  ): Promise<DepartmentDocument> {
    await this.assertUnique(dto.name, dto.code);
    const department = new this.departmentModel({
      ...dto,
      code: dto.code.toUpperCase(),
      createdBy: actorId,
    });
    return department.save();
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<DepartmentDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.departmentModel
        .find(filter)
        .sort(query.sortObject)
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.departmentModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as DepartmentDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  async findActive(): Promise<DepartmentDocument[]> {
    return this.departmentModel.find({ isActive: true }).lean();
  }

  async findById(id: string): Promise<DepartmentDocument> {
    const department = await this.departmentModel.findById(id);
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    actorId?: string,
  ): Promise<DepartmentDocument> {
    if (dto.name || dto.code) {
      await this.assertUnique(dto.name, dto.code, id);
    }
    const department = await this.departmentModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(dto.code ? { code: dto.code.toUpperCase() } : {}),
        updatedBy: actorId,
      },
      { new: true },
    );
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const result = await this.departmentModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    if (!result) {
      throw new NotFoundException(`Department ${id} not found`);
    }
  }

  async ensureSeeded(
    seeds: { name: string; code: string; location?: string }[],
  ): Promise<void> {
    for (const seed of seeds) {
      const exists = await this.departmentModel.findOne({ code: seed.code });
      if (!exists) {
        await this.departmentModel.create(seed);
      }
    }
  }

  private async assertUnique(
    name?: string,
    code?: string,
    excludeId?: string,
  ): Promise<void> {
    const orConditions: Record<string, unknown>[] = [];
    if (name) orConditions.push({ name });
    if (code) orConditions.push({ code: code.toUpperCase() });
    if (orConditions.length === 0) return;

    const filter: Record<string, unknown> = { $or: orConditions };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const existing = await this.departmentModel.findOne(filter);
    if (existing) {
      throw new ConflictException(
        'A department with this name or code already exists',
      );
    }
  }
}
