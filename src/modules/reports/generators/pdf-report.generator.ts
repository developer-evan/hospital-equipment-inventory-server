import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ReportCellValue, ReportTable } from '../reports.types';

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 20;

@Injectable()
export class PdfReportGenerator {
  /**
   * Renders a simple tabular PDF programmatically (no headless browser
   * dependency). Suitable for the moderate row counts typical of these
   * reports; a `puppeteer`-based HTML-to-PDF generator could be swapped
   * in later behind the same `ReportsService` call sites if richer
   * layouts are needed.
   */
  generate(table: ReportTable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: PAGE_MARGIN,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(table.title, { align: 'center' });
      doc
        .fontSize(9)
        .fillColor('gray')
        .text(`Generated ${table.generatedAt.toLocaleString()}`, {
          align: 'center',
        });
      doc.moveDown(1);
      doc.fillColor('black');

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;
      const columnWidth = pageWidth / table.columns.length;

      this.drawRow(
        doc,
        table.columns.map((c) => c.header),
        columnWidth,
        true,
      );

      for (const row of table.rows) {
        if (doc.y > doc.page.height - PAGE_MARGIN - ROW_HEIGHT) {
          doc.addPage();
        }
        this.drawRow(
          doc,
          table.columns.map((c) => this.formatCell(row[c.key])),
          columnWidth,
          false,
        );
      }

      doc.end();
    });
  }

  private drawRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    columnWidth: number,
    isHeader: boolean,
  ): void {
    const startX = PAGE_MARGIN;
    const startY = doc.y;
    doc
      .fontSize(isHeader ? 10 : 9)
      .font(isHeader ? 'Helvetica-Bold' : 'Helvetica');

    cells.forEach((cell, index) => {
      doc.text(cell, startX + index * columnWidth, startY, {
        width: columnWidth - 4,
        ellipsis: true,
      });
    });

    doc.y = startY + ROW_HEIGHT;
    if (isHeader) {
      doc
        .moveTo(startX, doc.y - 4)
        .lineTo(startX + columnWidth * cells.length, doc.y - 4)
        .stroke();
    }
  }

  private formatCell(value: ReportCellValue): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }
}
