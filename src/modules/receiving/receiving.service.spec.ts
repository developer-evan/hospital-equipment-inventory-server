import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EquipmentStatus } from '../equipment/enums/equipment-status.enum';
import { EquipmentService } from '../equipment/equipment.service';
import { EquipmentEvents } from './events/equipment-lifecycle.events';
import { ReceivingService } from './receiving.service';
import { EquipmentHistory } from './schemas/equipment-history.schema';

describe('ReceivingService', () => {
  let receivingService: ReceivingService;
  let equipmentService: jest.Mocked<EquipmentService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let historyModel: { create: jest.Mock };

  const departmentId = new Types.ObjectId();
  const actorId = new Types.ObjectId().toString();
  const equipmentId = new Types.ObjectId().toString();

  const buildEquipmentDoc = (status: EquipmentStatus) => ({
    id: equipmentId,
    assetNumber: 'EQ-2026-00001',
    status,
    department: departmentId,
    save: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    historyModel = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivingService,
        {
          provide: getModelToken(EquipmentHistory.name),
          useValue: historyModel,
        },
        {
          provide: EquipmentService,
          useValue: { create: jest.fn(), findById: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    receivingService = module.get(ReceivingService);
    equipmentService = module.get(EquipmentService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('registerIncoming', () => {
    it('creates the equipment as PENDING_INSTALLATION and records history + emits RECEIVED', async () => {
      const equipment = buildEquipmentDoc(EquipmentStatus.PENDING_INSTALLATION);
      equipmentService.create.mockResolvedValue(equipment as any);

      const result = await receivingService.registerIncoming(
        {} as any,
        actorId,
      );

      expect(equipmentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EquipmentStatus.PENDING_INSTALLATION,
        }),
        actorId,
      );
      expect(historyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: null,
          toStatus: EquipmentStatus.PENDING_INSTALLATION,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EquipmentEvents.RECEIVED,
        expect.objectContaining({ equipmentId: equipmentId }),
      );
      expect(result).toBe(equipment);
    });
  });

  describe('confirmInstallation', () => {
    it('transitions PENDING_INSTALLATION -> WORKING and emits INSTALLED', async () => {
      const equipment = buildEquipmentDoc(EquipmentStatus.PENDING_INSTALLATION);
      equipmentService.findById.mockResolvedValue(equipment as any);

      const result = await receivingService.confirmInstallation(
        equipmentId,
        {},
        actorId,
      );

      expect(result.status).toBe(EquipmentStatus.WORKING);
      expect(equipment.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EquipmentEvents.INSTALLED,
        expect.objectContaining({ equipmentId: equipmentId }),
      );
    });

    it('rejects confirming installation for equipment that is already WORKING', async () => {
      const equipment = buildEquipmentDoc(EquipmentStatus.WORKING);
      equipmentService.findById.mockResolvedValue(equipment as any);

      await expect(
        receivingService.confirmInstallation(equipmentId, {}, actorId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeStatus', () => {
    it.each([
      [EquipmentStatus.WORKING, EquipmentStatus.UNDER_REPAIR, true],
      [EquipmentStatus.WORKING, EquipmentStatus.CONDEMNED, true],
      [EquipmentStatus.WORKING, EquipmentStatus.DECOMMISSIONED, true],
      [EquipmentStatus.UNDER_REPAIR, EquipmentStatus.WORKING, true],
      [EquipmentStatus.UNDER_REPAIR, EquipmentStatus.CONDEMNED, true],
      [EquipmentStatus.CONDEMNED, EquipmentStatus.DECOMMISSIONED, true],
      [EquipmentStatus.PENDING_INSTALLATION, EquipmentStatus.CONDEMNED, false],
      [EquipmentStatus.DECOMMISSIONED, EquipmentStatus.WORKING, false],
      [EquipmentStatus.CONDEMNED, EquipmentStatus.WORKING, false],
    ])('from %s to %s is allowed=%s', async (from, to, allowed) => {
      const equipment = buildEquipmentDoc(from);
      equipmentService.findById.mockResolvedValue(equipment as any);

      const call = receivingService.changeStatus(
        equipmentId,
        { toStatus: to },
        actorId,
      );

      if (allowed) {
        await expect(call).resolves.toMatchObject({ status: to });
      } else {
        await expect(call).rejects.toThrow(BadRequestException);
      }
    });
  });
});
