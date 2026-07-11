import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import {
  buildPaginationMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetActiveStatusDto } from './dto/set-active-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto, actorId?: string): Promise<UserDocument> {
    await this.assertUnique(dto.username, dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = new this.userModel({
      ...dto,
      password: passwordHash,
      createdBy: actorId,
    });
    await user.save();
    user.password = undefined as unknown as string;
    return user;
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<UserDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.search) {
      filter.$or = [
        { username: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { fullName: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.userModel
        .find(filter)
        .populate('departments', 'name code')
        .sort(query.sortObject)
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as UserDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .populate('departments', 'name code');
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByUsernameWithPassword(
    username: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ username })
      .select('+password +refreshTokenHash')
      .exec();
  }

  async findByIdWithRefreshHash(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ): Promise<UserDocument> {
    if (dto.username || dto.email) {
      await this.assertUnique(dto.username, dto.email, id);
    }
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { ...dto, updatedBy: actorId },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async setActiveStatus(
    id: string,
    dto: SetActiveStatusDto,
    actorId?: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { isActive: dto.isActive, updatedBy: actorId },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userModel.findById(id).select('+password');
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();
  }

  async setRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { refreshTokenHash });
  }

  async recordLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastLoginAt: new Date() });
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const result = await this.userModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    if (!result) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  /**
   * Lightweight lookup used by notification fan-out (cron + event
   * listeners), which only ever need the recipient's id. `.lean()`
   * returns plain objects with no `id` virtual (that getter only
   * exists on hydrated `Document` instances), so it's mapped
   * explicitly here rather than leaking a misleading `UserDocument[]`
   * return type to callers.
   */
  async findActiveByRoles(roles: Role[]): Promise<Array<{ id: string }>> {
    const users = await this.userModel
      .find({ role: { $in: roles }, isActive: true })
      .select('_id')
      .lean();
    return users.map((user) => ({ id: user._id.toString() }));
  }

  async countAdmins(): Promise<number> {
    return this.userModel.countDocuments({ role: Role.ADMINISTRATOR });
  }

  async createRaw(
    data: Partial<User> & { password: string },
  ): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    return this.userModel.create({ ...data, password: passwordHash });
  }

  private async assertUnique(
    username?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    const orConditions: Record<string, unknown>[] = [];
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email: email.toLowerCase() });
    if (orConditions.length === 0) return;

    const filter: Record<string, unknown> = { $or: orConditions };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const existing = await this.userModel.findOne(filter);
    if (existing) {
      throw new ConflictException(
        'A user with this username or email already exists',
      );
    }
  }
}
