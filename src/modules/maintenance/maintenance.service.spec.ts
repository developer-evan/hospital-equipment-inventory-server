import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EquipmentService } from '../equipment/equipment.service';
import { MaintenanceStatus } from './enums/maintenance-status.enum';
import { MaintenanceType } from './enums/maintenance-type.enum';
import { MaintenanceEvents } from './events/maintenance.events';
import { MaintenanceService } from './maintenance.service';
import { Maintenance } from './schemas/maintenance.schema';

describe('MaintenanceService', () => {
  let maintenanceService: MaintenanceService;
  let equipmentService: jest.Mocked<EquipmentService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let maintenanceModel: jest.Mock & {
    create: jest.Mock;
    findById: jest.Mock;
    updateMany: jest.Mock;
  };

  const equipmentId = new Types.ObjectId();
  const actorId = new Types.ObjectId().toString();

  const buildEquipment = (
    overrides: Partial<Record<string, unknown>> = {},
  ) => ({
    id: equipmentId.toString(),
    pmFrequencyDays: 90,
    calibrationFrequencyDays: 365,
    ...overrides,
  });

  beforeEach(async () => {
    maintenanceModel = jest.fn() as any;
    maintenanceModel.create = jest.fn();
    maintenanceModel.findById = jest.fn();
    maintenanceModel.updateMany = jest
      .fn()
      .mockResolvedValue({ modifiedCount: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: getModelToken(Maintenance.name),
          useValue: maintenanceModel,
        },
        {
          provide: EquipmentService,
          useValue: { findById: jest.fn(), findScopedIds: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    maintenanceService = module.get(MaintenanceService);
    equipmentService = module.get(EquipmentService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('computes nextDueDate for PREVENTIVE records using the equipment PM frequency', async () => {
      equipmentService.findById.mockResolvedValue(buildEquipment() as any);
      maintenanceModel.create.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const scheduledDate = '2026-01-01T00:00:00.000Z';
      const record = await maintenanceService.create({
        equipment: equipmentId.toString(),
        type: MaintenanceType.PREVENTIVE,
        scheduledDate,
      });

      const expectedNextDue = new Date(scheduledDate);
      expectedNextDue.setDate(expectedNextDue.getDate() + 90);

      expect(record.status).toBe(MaintenanceStatus.SCHEDULED);
      expect((record as any).nextDueDate).toEqual(expectedNextDue);
    });

    it('computes nextDueDate for CALIBRATION records using the calibration frequency', async () => {
      equipmentService.findById.mockResolvedValue(buildEquipment() as any);
      maintenanceModel.create.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const scheduledDate = '2026-01-01T00:00:00.000Z';
      const record = await maintenanceService.create({
        equipment: equipmentId.toString(),
        type: MaintenanceType.CALIBRATION,
        scheduledDate,
      });

      const expectedNextDue = new Date(scheduledDate);
      expectedNextDue.setDate(expectedNextDue.getDate() + 365);

      expect((record as any).nextDueDate).toEqual(expectedNextDue);
    });

    it('marks the record COMPLETED immediately when a performedDate is supplied', async () => {
      equipmentService.findById.mockResolvedValue(buildEquipment() as any);
      maintenanceModel.create.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const record = await maintenanceService.create({
        equipment: equipmentId.toString(),
        type: MaintenanceType.CORRECTIVE,
        performedDate: '2026-01-01T00:00:00.000Z',
      });

      expect(record.status).toBe(MaintenanceStatus.COMPLETED);
    });
  });

  describe('markComplete', () => {
    it('throws when the record is already completed', async () => {
      const existing = {
        id: 'm-1',
        status: MaintenanceStatus.COMPLETED,
        save: jest.fn(),
      };
      maintenanceModel.findById = jest.fn().mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ populate: jest.fn().mockResolvedValue(existing) }),
      });

      await expect(
        maintenanceService.markComplete('m-1', {}, actorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('completes the record, emits an event, and schedules the next occurrence for recurring types', async () => {
      const existing: any = {
        id: 'm-1',
        equipment: equipmentId,
        type: MaintenanceType.PREVENTIVE,
        status: MaintenanceStatus.SCHEDULED,
        save: jest.fn().mockResolvedValue(undefined),
      };
      maintenanceModel.findById = jest.fn().mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ populate: jest.fn().mockResolvedValue(existing) }),
      });
      equipmentService.findById.mockResolvedValue(buildEquipment() as any);
      maintenanceModel.create.mockResolvedValue({});

      const result = await maintenanceService.markComplete('m-1', {}, actorId);

      expect(result.status).toBe(MaintenanceStatus.COMPLETED);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MaintenanceEvents.COMPLETED,
        expect.objectContaining({ maintenanceId: 'm-1' }),
      );
      expect(maintenanceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MaintenanceStatus.SCHEDULED,
          type: MaintenanceType.PREVENTIVE,
        }),
      );
    });
  });

  describe('markOverdueRecords', () => {
    it('flips SCHEDULED records past their scheduled date to OVERDUE', async () => {
      maintenanceModel.updateMany.mockResolvedValue({ modifiedCount: 3 });
      const count = await maintenanceService.markOverdueRecords();
      expect(count).toBe(3);
      expect(maintenanceModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: MaintenanceStatus.SCHEDULED }),
        { status: MaintenanceStatus.OVERDUE },
      );
    });
  });
});
