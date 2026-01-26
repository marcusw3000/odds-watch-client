import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExport } from '@/hooks/useExport';

interface ExportMenuProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  title?: string;
  disabled?: boolean;
}

export function ExportMenu<T extends Record<string, unknown>>({
  data,
  filename,
  title,
  disabled = false,
}: ExportMenuProps<T>) {
  const { exportToCSV, exportToExcel, exportToPDF, exporting } = useExport();

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const options = { filename, title };
    
    switch (format) {
      case 'csv':
        exportToCSV(data, options);
        break;
      case 'excel':
        exportToExcel(data, options);
        break;
      case 'pdf':
        exportToPDF(data, options);
        break;
    }
  };

  const isDisabled = disabled || data.length === 0 || exporting;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
