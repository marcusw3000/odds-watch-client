import { ResolutionSource } from './admin';
import { CardStyleType } from './cardStyles';
import { RecurrenceType } from './market';

export interface EventTemplate {
  id: string;
  name: string;
  category: string;
  title_pattern: string;
  description: string;
  resolution: ResolutionSource | null;
  card_style: CardStyleType;
  recurrence_type: RecurrenceType;
  tags: string[];
  created_by: string | null;
  created_at: string;
}

export interface CreateEventTemplateData {
  name: string;
  category: string;
  title_pattern: string;
  description?: string;
  resolution?: ResolutionSource;
  card_style?: CardStyleType;
  recurrence_type?: RecurrenceType;
  tags?: string[];
}
