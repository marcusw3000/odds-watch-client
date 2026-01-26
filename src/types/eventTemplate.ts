import { CardStyleType } from './cardStyles';
import { RecurrenceType } from './market';
import { Json } from '@/integrations/supabase/types';

// Resolution source for templates (flexible JSON)
export interface TemplateResolution {
  type?: string;
  name?: string;
  url?: string;
  rule?: string;
}

export interface EventTemplate {
  id: string;
  name: string;
  category: string;
  title_pattern: string;
  description: string | null;
  resolution: TemplateResolution | null;
  card_style: string;
  recurrence_type: string;
  tags: string[];
  created_by: string | null;
  created_at: string;
}

export interface CreateEventTemplateData {
  name: string;
  category: string;
  title_pattern: string;
  description?: string;
  resolution?: TemplateResolution;
  card_style?: CardStyleType;
  recurrence_type?: RecurrenceType;
  tags?: string[];
}
