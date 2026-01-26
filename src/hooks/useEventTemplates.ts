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
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('event_templates')
        .insert([{
          name: template.name,
          category: template.category,
          title_pattern: template.title_pattern,
          description: template.description || null,
          resolution: template.resolution ? JSON.parse(JSON.stringify(template.resolution)) : null,
          card_style: template.card_style || 'default',
          recurrence_type: template.recurrence_type || 'none',
          tags: template.tags || [],
          created_by: user?.id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        resolution: data.resolution as EventTemplate['resolution'],
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
      const { error } = await supabase
        .from('event_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
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
