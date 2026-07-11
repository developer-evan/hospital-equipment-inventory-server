import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enums/role.enum';
import { DEFAULT_DEPARTMENTS } from '../modules/departments/departments.constants';
import { DepartmentsService } from '../modules/departments/departments.service';
import { UsersService } from '../modules/users/users.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly departmentsService: DepartmentsService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedDepartments();
    await this.seedDefaultAdmin();
  }

  private async seedDepartments(): Promise<void> {
    await this.departmentsService.ensureSeeded(DEFAULT_DEPARTMENTS);
    this.logger.log(
      `Ensured ${DEFAULT_DEPARTMENTS.length} default departments exist`,
    );
  }

  private async seedDefaultAdmin(): Promise<void> {
    const existingAdmins = await this.usersService.countAdmins();
    if (existingAdmins > 0) {
      return;
    }

    const { username, email, password } = this.configService.get<{
      username: string;
      email: string;
      password: string;
    }>('defaultAdmin')!;
    await this.usersService.createRaw({
      username,
      email,
      password,
      fullName: 'System Administrator',
      role: Role.ADMINISTRATOR,
      isActive: true,
    });

    this.logger.warn(
      `Seeded default administrator "${username}" with the password from DEFAULT_ADMIN_PASSWORD. ` +
        'Change this password immediately after first login.',
    );
  }
}
