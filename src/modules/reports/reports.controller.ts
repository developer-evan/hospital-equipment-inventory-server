import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';
import type { ReportTable } from './reports.types';

/** Reports are Administrator-only, per the role permission table in the spec. */
@ApiTags('Reports')
@ApiBearerAuth()
@Roles(Role.ADMINISTRATOR)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('inventory')
  inventory(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildInventoryReport(filter, user),
      filter,
    );
  }

  @Get('department-inventory')
  departmentInventory(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildDepartmentInventoryReport(filter, user),
      filter,
    );
  }

  @Get('condemned')
  condemned(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildCondemnedReport(filter, user),
      filter,
    );
  }

  @Get('pm')
  pm(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildPmReport(filter, user),
      filter,
    );
  }

  @Get('breakdown')
  breakdown(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildBreakdownReport(filter, user),
      filter,
    );
  }

  @Get('engineer-work')
  engineerWork(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    return this.respond(
      res,
      this.reportsService.buildEngineerWorkReport(filter, user),
      filter,
    );
  }

  private async respond(
    res: Response,
    tablePromise: Promise<ReportTable>,
    filter: ReportFilterDto,
  ): Promise<void> {
    const table = await tablePromise;
    const file = await this.reportsService.export(
      table,
      filter.format ?? 'excel',
    );
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    res.send(file.buffer);
  }
}
