import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type ExportFormat = 'json' | 'csv';

export function ExportDataButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        body: { format },
      });

      if (error) {
        // Check for rate limit error (429 status)
        const context = (error as any).context;
        const isRateLimited = context?.status === 429 || 
          error.message?.includes('429') || 
          error.message?.includes('rate');
        
        if (isRateLimited) {
          toast({
            title: 'Limite excedido',
            description: 'Você só pode exportar seus dados uma vez por hora.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      // Check if response contains rate limit error
      if (data?.error === 'Rate limit exceeded') {
        toast({
          title: 'Limite excedido',
          description: data.message || 'Você só pode exportar seus dados uma vez por hora.',
          variant: 'destructive',
        });
        return;
      }

      // Create blob and download
      const blob = format === 'json' 
        ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        : new Blob([data.csv], { type: 'text/csv' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meus-dados-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Exportação concluída',
        description: `Seus dados foram exportados no formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível exportar seus dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Exportar meus dados
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileJson className="h-4 w-4 mr-2" />
          Exportar como JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar como CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
