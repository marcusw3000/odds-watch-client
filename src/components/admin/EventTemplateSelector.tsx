import { useState } from 'react';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEventTemplates, useCreateEventTemplate, useDeleteEventTemplate } from '@/hooks/useEventTemplates';
import { EventTemplate } from '@/types/eventTemplate';
import { ResolutionSource, EVENT_CATEGORIES } from '@/types/admin';
import { CardStyleType } from '@/types/cardStyles';
import { RecurrenceType } from '@/types/market';

interface EventTemplateSelectorProps {
  onSelect: (template: EventTemplate) => void;
  currentData?: {
    title: string;
    description: string;
    category: string;
    resolution?: ResolutionSource;
    cardStyle?: CardStyleType;
    recurrenceType?: RecurrenceType;
    tags?: string[];
  };
}

export function EventTemplateSelector({ onSelect, currentData }: EventTemplateSelectorProps) {
  const { data: templates = [], isLoading } = useEventTemplates();
  const createMutation = useCreateEventTemplate();
  const deleteMutation = useDeleteEventTemplate();
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onSelect(template);
      setSelectedTemplate(templateId);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !currentData) return;

    await createMutation.mutateAsync({
      name: newTemplateName,
      category: currentData.category || 'Outros',
      title_pattern: currentData.title,
      description: currentData.description,
      resolution: currentData.resolution,
      card_style: currentData.cardStyle,
      recurrence_type: currentData.recurrenceType,
      tags: currentData.tags,
    });

    setNewTemplateName('');
    setSaveDialogOpen(false);
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteMutation.mutateAsync(templateId);
    if (selectedTemplate === templateId) {
      setSelectedTemplate('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedTemplate} onValueChange={handleSelectTemplate}>
        <SelectTrigger className="w-[250px]">
          <FileText className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Usar template..." />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum template salvo
            </div>
          ) : (
            templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.category}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={!currentData?.title}>
            <Plus className="h-4 w-4 mr-1" />
            Salvar Template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como Template</DialogTitle>
            <DialogDescription>
              Salve a configuração atual para reutilizar em eventos futuros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do Template</Label>
              <Input
                id="template-name"
                placeholder="Ex: Selic Mensal, Eleição 2026..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            {currentData && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Título:</strong> {currentData.title || '-'}</p>
                <p><strong>Categoria:</strong> {currentData.category || '-'}</p>
                <p><strong>Estilo:</strong> {currentData.cardStyle || 'default'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveTemplate} 
              disabled={!newTemplateName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List for managing templates */}
      {templates.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Gerenciar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerenciar Templates</DialogTitle>
              <DialogDescription>
                Visualize e exclua templates salvos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.category} • {template.title_pattern.substring(0, 50)}...
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteTemplate(template.id, e)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
