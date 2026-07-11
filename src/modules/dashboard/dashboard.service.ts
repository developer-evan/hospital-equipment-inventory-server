import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { buildDepartmentFilter } from '../../common/utils/department-scope.util';
import {
  Equipment,
  EquipmentDocument,
} from '../equipment/schemas/equipment.schema';
import { EquipmentStatus } from '../equipment/enums/equipment-status.enum';
import { MaintenanceStatus } from '../maintenance/enums/maintenance-status.enum';
import { MaintenanceType } from '../maintenance/enums/maintenance-type.enum';
import {
  Maintenance,
  MaintenanceDocument,
} from '../maintenance/schemas/maintenance.schema';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface CountFacetResult {
  count?: number;
}

interface DepartmentBreakdownFacetResult {
  _id: Types.ObjectId;
  count: number;
  department: { name: string; code: string }[];
}

export interface DashboardSummary {
  totalEquipment: number;
  working: number;
  underRepair: number;
  condemned: number;
  pendingInstallation: number;
  decommissioned: number;
  pmDueThisMonth: number;
  receivedToday: number;
  byDepartment: {
    departmentId: string;
    departmentName: string;
    count: number;
  }[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<MaintenanceDocument>,
  ) {}

  async getSummary(
    query: DashboardQueryDto,
    user: AuthenticatedUser,
  ): Promise<DashboardSummary> {
    const baseFilter: Record<string, unknown> = {
      ...buildDepartmentFilter(user),
    };
    if (query.department) {
      baseFilter.department = new Types.ObjectId(query.department);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [facetResult] = await this.equipmentModel.aggregate<{
      totalEquipment: CountFacetResult[];
      working: CountFacetResult[];
      underRepair: CountFacetResult[];
      condemned: CountFacetResult[];
      pendingInstallation: CountFacetResult[];
      decommissioned: CountFacetResult[];
      receivedToday: CountFacetResult[];
      byDepartment: DepartmentBreakdownFacetResult[];
    }>([
      { $match: baseFilter },
      {
        $facet: {
          totalEquipment: [{ $count: 'count' }],
          working: [
            { $match: { status: EquipmentStatus.WORKING } },
            { $count: 'count' },
          ],
          underRepair: [
            { $match: { status: EquipmentStatus.UNDER_REPAIR } },
            { $count: 'count' },
          ],
          condemned: [
            { $match: { status: EquipmentStatus.CONDEMNED } },
            { $count: 'count' },
          ],
          pendingInstallation: [
            { $match: { status: EquipmentStatus.PENDING_INSTALLATION } },
            { $count: 'count' },
          ],
          decommissioned: [
            { $match: { status: EquipmentStatus.DECOMMISSIONED } },
            { $count: 'count' },
          ],
          receivedToday: [
            { $match: { createdAt: { $gte: startOfToday } } },
            { $count: 'count' },
          ],
          byDepartment: [
            { $group: { _id: '$department', count: { $sum: 1 } } },
            {
              $lookup: {
                from: 'departments',
                localField: '_id',
                foreignField: '_id',
                as: 'department',
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);

    const pmDueThisMonth = await this.countPmDueThisMonth(baseFilter);

    return {
      totalEquipment: this.extractCount(facetResult.totalEquipment),
      working: this.extractCount(facetResult.working),
      underRepair: this.extractCount(facetResult.underRepair),
      condemned: this.extractCount(facetResult.condemned),
      pendingInstallation: this.extractCount(facetResult.pendingInstallation),
      decommissioned: this.extractCount(facetResult.decommissioned),
      receivedToday: this.extractCount(facetResult.receivedToday),
      pmDueThisMonth,
      byDepartment: facetResult.byDepartment.map((row) => ({
        departmentId: row._id?.toString(),
        departmentName: row.department[0]?.name ?? 'Unknown',
        count: row.count,
      })),
    };
  }

  private async countPmDueThisMonth(
    equipmentFilter: Record<string, unknown>,
  ): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const scopedEquipmentIds = await this.equipmentModel
      .find(equipmentFilter)
      .select('_id')
      .lean();

    return this.maintenanceModel.countDocuments({
      equipment: { $in: scopedEquipmentIds.map((e) => e._id) },
      type: { $in: [MaintenanceType.PREVENTIVE, MaintenanceType.CALIBRATION] },
      status: { $in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.OVERDUE] },
      scheduledDate: { $gte: startOfMonth, $lt: startOfNextMonth },
    });
  }

  private extractCount(facet: CountFacetResult[]): number {
    return facet[0]?.count ?? 0;
  }
}
