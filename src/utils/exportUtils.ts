import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
}

export async function exportToExcel(
  filename: string,
  reportTitle: string,
  columns: ExportColumn[],
  rows: Array<Record<string, string | number>>,
  metaInfo: { generatedDate: string; totalCount: number; divisionFilter?: string }
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manthai West Divisional Secretariat';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Report');

  const titleRow = sheet.addRow(['Manthai West Divisional Secretariat']);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

  const subtitleRow = sheet.addRow(['Elderly Citizen Management System']);
  subtitleRow.font = { bold: true, size: 11, color: { argb: 'FF334155' } };

  const reportRow = sheet.addRow([reportTitle]);
  reportRow.font = { bold: true, size: 12 };

  sheet.addRow([
    `Generated Date: ${metaInfo.generatedDate}`,
    `Total Record Count: ${metaInfo.totalCount}`,
    metaInfo.divisionFilter ? `GN Division: ${metaInfo.divisionFilter}` : '',
  ]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: 'FF0F172A' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  for (const row of rows) {
    sheet.addRow(columns.map((c) => row[c.key] ?? ''));
  }

  columns.forEach((c, idx) => {
    const col = sheet.getColumn(idx + 1);
    const maxLen = Math.max(
      c.header.length,
      ...rows.map((r) => String(r[c.key] ?? '').length)
    );
    col.width = Math.min(Math.max(maxLen + 4, 14), 42);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPdf(
  filename: string,
  reportTitle: string,
  columns: ExportColumn[],
  rows: Array<Record<string, string | number>>,
  metaInfo: { generatedDate: string; totalCount: number; divisionFilter?: string }
): void {
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Manthai West Divisional Secretariat', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Elderly Citizen Management System', 14, 18);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(reportTitle, 14, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const metaParts = [
    `Generated Date: ${metaInfo.generatedDate}`,
    `Total Record Count: ${metaInfo.totalCount}`,
  ];
  if (metaInfo.divisionFilter) {
    metaParts.push(`GN Division: ${metaInfo.divisionFilter}`);
  }
  doc.text(metaParts.join('   |   '), 14, 41);

  autoTable(doc, {
    startY: 46,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Manthai West Divisional Secretariat — Elderly Citizen Management System`,
        14,
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
