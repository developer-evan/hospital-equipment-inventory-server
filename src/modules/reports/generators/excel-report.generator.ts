import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ReportTable } from '../reports.types';

@Injectable()
export class ExcelReportGenerator {
  async generate(table: ReportTable): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Hospital Equipment Inventory Management System';
    workbook.created = table.generatedAt;

    const sheet = workbook.addWorksheet(table.title.slice(0, 31));

    sheet.columns = table.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? 20,
    }));
    sheet.getRow(1).font = { bold: true };

    for (const row of table.rows) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
