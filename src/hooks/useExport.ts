import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface ExportOptions {
  filename: string;
  title?: string;
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
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value ?? '');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
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
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, options.title || 'Dados');
      
      // Auto-size columns
      const colWidths = Object.keys(data[0]).map(key => {
        const maxLength = Math.max(
          key.length,
          ...data.map(row => String(row[key] ?? '').length)
        );
        return { wch: Math.min(maxLength + 2, 50) };
      });
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `${options.filename}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, []);

  const exportToPDF = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions
  ) => {
    if (data.length === 0) return;

    setExporting(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      // Title
      if (options.title) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(options.title, margin, y);
        y += 10;
      }

      // Date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y);
      y += 8;

      // Table headers
      const headers = Object.keys(data[0]);
      const colWidth = (pageWidth - 2 * margin) / Math.min(headers.length, 8);
      const visibleHeaders = headers.slice(0, 8); // Limit columns for PDF

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
      
      visibleHeaders.forEach((header, i) => {
        doc.text(
          header.substring(0, 15), 
          margin + i * colWidth + 2, 
          y + 5
        );
      });
      y += 10;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      data.forEach((row, rowIndex) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        // Alternate row background
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
        }

        visibleHeaders.forEach((header, i) => {
          const value = String(row[header] ?? '').substring(0, 20);
          doc.text(value, margin + i * colWidth + 2, y);
        });
        y += 6;
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      doc.save(`${options.filename}.pdf`);
    } finally {
      setExporting(false);
    }
  }, []);

  return {
    exportToCSV,
    exportToExcel,
    exportToPDF,
    exporting,
  };
}
