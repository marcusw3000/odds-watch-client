import { useCallback, useState } from 'react';

interface ExportOptions {
  filename: string;
  title?: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toExportString(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.split('\0').join('');
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions
  ) => {
    if (data.length === 0) return;

    setExporting(true);
    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map((row) =>
          headers
            .map((header) => {
              const stringValue = toExportString(row[header]);
              if (
                stringValue.includes(',') ||
                stringValue.includes('"') ||
                stringValue.includes('\n')
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      downloadBlob(blob, `${options.filename}.csv`);
    } finally {
      setExporting(false);
    }
  }, []);

  const exportToExcel = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions
  ) => {
    if (data.length === 0) return;

    setExporting(true);
    return import('exceljs')
      .then(async ({ Workbook }) => {
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet(options.title || 'Dados');
        const headers = Object.keys(data[0]);

        worksheet.addRow(headers);
        worksheet.getRow(1).font = { bold: true };

        data.forEach((row) => {
          worksheet.addRow(headers.map((header) => toExportString(row[header])));
        });

        worksheet.columns = headers.map((header) => {
          const maxLength = Math.max(
            header.length,
            ...data.map((row) => toExportString(row[header]).length)
          );

          return {
            header,
            key: header,
            width: Math.min(maxLength + 2, 50),
          };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, `${options.filename}.xlsx`);
      })
      .finally(() => {
        setExporting(false);
      });
  }, []);

  const exportToPDF = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions
  ) => {
    if (data.length === 0) return;

    setExporting(true);
    return import('jspdf')
      .then(({ jsPDF }) => {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        if (options.title) {
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text(toExportString(options.title), margin, y);
          y += 10;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y);
        y += 8;

        const headers = Object.keys(data[0]);
        const colWidth = (pageWidth - 2 * margin) / Math.min(headers.length, 8);
        const visibleHeaders = headers.slice(0, 8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');

        visibleHeaders.forEach((header, i) => {
          doc.text(header.substring(0, 15), margin + i * colWidth + 2, y + 5);
        });
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        data.forEach((row, rowIndex) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }

          if (rowIndex % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
          }

          visibleHeaders.forEach((header, i) => {
            const value = toExportString(row[header]).substring(0, 20);
            doc.text(value, margin + i * colWidth + 2, y);
          });
          y += 6;
        });

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text(`Pagina ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, {
            align: 'center',
          });
        }

        doc.save(`${options.filename}.pdf`);
      })
      .finally(() => {
        setExporting(false);
      });
  }, []);

  return {
    exportToCSV,
    exportToExcel,
    exportToPDF,
    exporting,
  };
}
