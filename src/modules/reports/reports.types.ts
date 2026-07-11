export type ReportCellValue =
  string | number | boolean | Date | null | undefined;

export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
}

export interface ReportTable {
  title: string;
  generatedAt: Date;
  columns: ReportColumn[];
  rows: Record<string, ReportCellValue>[];
}

export type ReportFormat = 'excel' | 'pdf';
