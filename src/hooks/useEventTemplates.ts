import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EventTemplate, CreateEventTemplateData } from '@/types/eventTemplate';
import { toast } from 'sonner';

export function useEventTemplates() {
  return useQuery({
    queryKey: ['event-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        resolution: item.resolution as EventTemplate['resolution'],
      })) as EventTemplate[];
    },
  });
}

export function useCreateEventTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: CreateEventTemplateData) => {
      const { data, error } = await supabase.functions.invoke('manage-event-templates', {
        method: 'POST',
        body: {
          action: 'create',
          template,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return {
        ...data.template,
        resolution: data.template.resolution as EventTemplate['resolution'],
      } as EventTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] });
      toast.success('Template criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar template: ' + error.message);
    },
  });
}

export function useDeleteEventTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-event-templates', {
        method: 'POST',
        body: {
          action: 'delete',
          templateId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] });
      toast.success('Template excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir template: ' + error.message);
    },
  });
}

export function useEventTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['event-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const { data, error } = await supabase
        .from('event_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      return {
        ...data,
        resolution: data.resolution as EventTemplate['resolution'],
      } as EventTemplate;
    },
    enabled: !!templateId,
  });
}
