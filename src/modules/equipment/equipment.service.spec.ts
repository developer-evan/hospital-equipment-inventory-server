import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { SequenceService } from '../../common/utils/sequence.service';
import { FilesService } from '../files/files.service';
import { EquipmentStatus } from './enums/equipment-status.enum';
import { EquipmentService } from './equipment.service';
import { Equipment } from './schemas/equipment.schema';

jest.mock('../../common/utils/qrcode.util', () => ({
  generateQrCodePng: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
}));

describe('EquipmentService', () => {
  let equipmentService: EquipmentService;
  let sequenceService: jest.Mocked<SequenceService>;
  let filesService: jest.Mocked<FilesService>;
  let equipmentModel: jest.Mock & {
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  const baseDto = {
    name: 'Patient Monitor',
    category: 'Diagnostic',
    manufacturer: 'Philips',
    serialNumber: 'SN-123',
    department: '64b000000000000000000001',
  };

  beforeEach(async () => {
    const savedDoc = {
      id: 'equipment-1',
      assetNumber: '',
      photoUrls: [],
      manualUrls: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    equipmentModel = jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) => ({
        ...savedDoc,
        ...data,
        save: savedDoc.save,
      })) as any;
    equipmentModel.findOne = jest.fn().mockResolvedValue(null);
    equipmentModel.findById = jest.fn();
    equipmentModel.findByIdAndUpdate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: getModelToken(Equipment.name), useValue: equipmentModel },
        { provide: SequenceService, useValue: { next: jest.fn() } },
        {
          provide: FilesService,
          useValue: {
            uploadOne: jest.fn().mockResolvedValue({
              key: 'qr-codes/x.png',
              url: 'http://x/qr.png',
            }),
            uploadMany: jest.fn(),
          },
        },
      ],
    }).compile();

    equipmentService = module.get(EquipmentService);
    sequenceService = module.get(SequenceService);
    filesService = module.get(FilesService);
  });

  describe('create', () => {
    it('auto-generates a sequential asset number when none is provided', async () => {
      sequenceService.next.mockResolvedValue(7);

      const result = await equipmentService.create(baseDto, 'actor-1');

      const year = new Date().getFullYear();
      expect(result.assetNumber).toBe(`EQ-${year}-00007`);
      expect(sequenceService.next).toHaveBeenCalledWith(
        `equipment-asset-number-${year}`,
      );
    });

    it('respects a manually provided asset number and skips generation', async () => {
      const result = await equipmentService.create(
        { ...baseDto, assetNumber: 'MANUAL-001' },
        'actor-1',
      );

      expect(result.assetNumber).toBe('MANUAL-001');
      expect(sequenceService.next).not.toHaveBeenCalled();
    });

    it('defaults status to PENDING_INSTALLATION', async () => {
      sequenceService.next.mockResolvedValue(1);
      const result = await equipmentService.create(baseDto);
      expect(result.status).toBe(EquipmentStatus.PENDING_INSTALLATION);
    });

    it('generates and attaches a QR code after saving', async () => {
      sequenceService.next.mockResolvedValue(1);
      const result = await equipmentService.create(baseDto);

      expect(filesService.uploadOne).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'image/png' }),
        'qr-codes',
        ['image/png'],
      );
      expect((result as any).qrCodeUrl).toBe('http://x/qr.png');
    });

    it('throws ConflictException when serial number or asset number already exists', async () => {
      equipmentModel.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(equipmentService.create(baseDto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
