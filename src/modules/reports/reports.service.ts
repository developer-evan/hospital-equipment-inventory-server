import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { buildDepartmentFilter } from '../../common/utils/department-scope.util';
import {
  Equipment,
  EquipmentDocument,
} from '../equipment/schemas/equipment.schema';
import { MaintenanceType } from '../maintenance/enums/maintenance-type.enum';
import {
  Maintenance,
  MaintenanceDocument,
} from '../maintenance/schemas/maintenance.schema';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ExcelReportGenerator } from './generators/excel-report.generator';
import { PdfReportGenerator } from './generators/pdf-report.generator';
import { ReportCellValue, ReportColumn, ReportTable } from './reports.types';

interface LeanEquipmentRow {
  assetNumber: string;
  name: string;
  category: string;
  department?: { name?: string } | null;
  status: string;
  serialNumber: string;
  purchaseDate?: Date;
  warrantyEndDate?: Date;
}

interface LeanMaintenanceRow {
  equipment?: { assetNumber?: string; name?: string } | null;
  type: string;
  scheduledDate?: Date;
  performedDate?: Date;
  engineer?: { fullName?: string } | null;
  status: string;
  spareParts?: { cost: number; quantity: number }[];
}

export interface GeneratedReportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const EQUIPMENT_COLUMNS: ReportColumn[] = [
  { key: 'assetNumber', header: 'Asset Number' },
  { key: 'name', header: 'Name' },
  { key: 'category', header: 'Category' },
  { key: 'department', header: 'Department' },
  { key: 'status', header: 'Status' },
  { key: 'serialNumber', header: 'Serial Number' },
  { key: 'purchaseDate', header: 'Purchase Date' },
  { key: 'warrantyEndDate', header: 'Warranty End' },
];

const MAINTENANCE_COLUMNS: ReportColumn[] = [
  { key: 'assetNumber', header: 'Asset Number' },
  { key: 'equipmentName', header: 'Equipment' },
  { key: 'type', header: 'Type' },
  { key: 'scheduledDate', header: 'Scheduled Date' },
  { key: 'performedDate', header: 'Performed Date' },
  { key: 'engineer', header: 'Engineer' },
  { key: 'status', header: 'Status' },
  { key: 'sparePartsCost', header: 'Spare Parts Cost' },
];

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<MaintenanceDocument>,
    private readonly excelGenerator: ExcelReportGenerator,
    private readonly pdfGenerator: PdfReportGenerator,
  ) {}

  async buildInventoryReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    const equipmentFilter = this.buildEquipmentFilter(filter, user);
    const equipment = await this.equipmentModel
      .find(equipmentFilter)
      .populate('department', 'name')
      .lean<LeanEquipmentRow[]>();

    return {
      title: 'Equipment Inventory Report',
      generatedAt: new Date(),
      columns: EQUIPMENT_COLUMNS,
      rows: equipment.map((e) => this.equipmentRow(e)),
    };
  }

  async buildDepartmentInventoryReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    if (!filter.department) {
      throw new BadRequestException(
        'department is required for the department inventory report',
      );
    }
    const table = await this.buildInventoryReport(filter, user);
    return { ...table, title: 'Department Inventory Report' };
  }

  async buildCondemnedReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    const equipmentFilter = this.buildEquipmentFilter(
      { ...filter, status: undefined },
      user,
    );
    equipmentFilter.status = 'CONDEMNED';

    const equipment = await this.equipmentModel
      .find(equipmentFilter)
      .populate('department', 'name')
      .lean<LeanEquipmentRow[]>();

    return {
      title: 'Condemned Equipment Report',
      generatedAt: new Date(),
      columns: EQUIPMENT_COLUMNS,
      rows: equipment.map((e) => this.equipmentRow(e)),
    };
  }

  async buildPmReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    const maintenanceFilter = await this.buildMaintenanceFilter(filter, user);
    maintenanceFilter.type = {
      $in: [MaintenanceType.PREVENTIVE, MaintenanceType.CALIBRATION],
    };

    const records = await this.fetchMaintenance(maintenanceFilter);
    return {
      title: 'Preventive Maintenance & Calibration Report',
      generatedAt: new Date(),
      columns: MAINTENANCE_COLUMNS,
      rows: records.map((r) => this.maintenanceRow(r)),
    };
  }

  async buildBreakdownReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    const maintenanceFilter = await this.buildMaintenanceFilter(filter, user);
    maintenanceFilter.type = MaintenanceType.CORRECTIVE;

    const records = await this.fetchMaintenance(maintenanceFilter);
    return {
      title: 'Breakdown / Corrective Maintenance Report',
      generatedAt: new Date(),
      columns: MAINTENANCE_COLUMNS,
      rows: records.map((r) => this.maintenanceRow(r)),
    };
  }

  async buildEngineerWorkReport(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<ReportTable> {
    if (!filter.engineer) {
      throw new BadRequestException(
        'engineer is required for the engineer work report',
      );
    }
    const maintenanceFilter = await this.buildMaintenanceFilter(filter, user);

    const records = await this.fetchMaintenance(maintenanceFilter);
    return {
      title: 'Engineer Work Report',
      generatedAt: new Date(),
      columns: MAINTENANCE_COLUMNS,
      rows: records.map((r) => this.maintenanceRow(r)),
    };
  }

  async export(
    table: ReportTable,
    format: 'excel' | 'pdf',
  ): Promise<GeneratedReportFile> {
    const slug = table.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (format === 'pdf') {
      const buffer = await this.pdfGenerator.generate(table);
      return {
        buffer,
        filename: `${slug}.pdf`,
        contentType: 'application/pdf',
      };
    }
    const buffer = await this.excelGenerator.generate(table);
    return {
      buffer,
      filename: `${slug}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private buildEquipmentFilter(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Record<string, unknown> {
    const equipmentFilter: Record<string, unknown> = {
      ...buildDepartmentFilter(user),
    };
    if (filter.department)
      equipmentFilter.department = new Types.ObjectId(filter.department);
    if (filter.status) equipmentFilter.status = filter.status;
    if (filter.from || filter.to) {
      equipmentFilter.createdAt = {
        ...(filter.from ? { $gte: new Date(filter.from) } : {}),
        ...(filter.to ? { $lte: new Date(filter.to) } : {}),
      };
    }
    return equipmentFilter;
  }

  private async buildMaintenanceFilter(
    filter: ReportFilterDto,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const maintenanceFilter: Record<string, unknown> = {};
    if (filter.engineer)
      maintenanceFilter.engineer = new Types.ObjectId(filter.engineer);
    if (filter.from || filter.to) {
      maintenanceFilter.scheduledDate = {
        ...(filter.from ? { $gte: new Date(filter.from) } : {}),
        ...(filter.to ? { $lte: new Date(filter.to) } : {}),
      };
    }

    const equipmentFilter = this.buildEquipmentFilter(
      { ...filter, from: undefined, to: undefined },
      user,
    );
    if (Object.keys(equipmentFilter).length > 0) {
      const equipmentIds = await this.equipmentModel
        .find(equipmentFilter)
        .select('_id')
        .lean();
      maintenanceFilter.equipment = { $in: equipmentIds.map((e) => e._id) };
    }

    return maintenanceFilter;
  }

  private async fetchMaintenance(
    filter: Record<string, unknown>,
  ): Promise<LeanMaintenanceRow[]> {
    return this.maintenanceModel
      .find(filter)
      .populate('equipment', 'assetNumber name')
      .populate('engineer', 'fullName username')
      .sort({ scheduledDate: -1 })
      .lean<LeanMaintenanceRow[]>();
  }

  private equipmentRow(
    equipment: LeanEquipmentRow,
  ): Record<string, ReportCellValue> {
    return {
      assetNumber: equipment.assetNumber,
      name: equipment.name,
      category: equipment.category,
      department: equipment.department?.name ?? '',
      status: equipment.status,
      serialNumber: equipment.serialNumber,
      purchaseDate: equipment.purchaseDate,
      warrantyEndDate: equipment.warrantyEndDate,
    };
  }

  private maintenanceRow(
    record: LeanMaintenanceRow,
  ): Record<string, ReportCellValue> {
    const sparePartsCost = (record.spareParts ?? []).reduce(
      (sum, part) => sum + part.cost * part.quantity,
      0,
    );
    return {
      assetNumber: record.equipment?.assetNumber ?? '',
      equipmentName: record.equipment?.name ?? '',
      type: record.type,
      scheduledDate: record.scheduledDate,
      performedDate: record.performedDate,
      engineer: record.engineer?.fullName ?? '',
      status: record.status,
      sparePartsCost,
    };
  }
}
