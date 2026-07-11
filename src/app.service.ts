import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'hospital-equipment-inventory-sys',
      timestamp: new Date().toISOString(),
    };
  }
}
