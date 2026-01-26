import { useNavigate } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminEvent } from '@/hooks/useAdminEvents';
import { addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';

interface DuplicateEventButtonProps {
  event: AdminEvent;
}

export function DuplicateEventButton({ event }: DuplicateEventButtonProps) {
  const navigate = useNavigate();

  const handleDuplicate = () => {
    // Calculate new dates based on recurrence type
    const recurrenceType = event.recurrence_type || 'none';
    const closeDate = event.close_date ? new Date(event.close_date) : new Date();
    const settlementDate = event.settlement_date ? new Date(event.settlement_date) : new Date();

    let newCloseDate = closeDate;
    let newSettlementDate = settlementDate;

    switch (recurrenceType) {
      case 'weekly':
        newCloseDate = addWeeks(closeDate, 1);
        newSettlementDate = addWeeks(settlementDate, 1);
        break;
      case 'monthly':
        newCloseDate = addMonths(closeDate, 1);
        newSettlementDate = addMonths(settlementDate, 1);
        break;
      case 'quarterly':
        newCloseDate = addQuarters(closeDate, 1);
        newSettlementDate = addQuarters(settlementDate, 1);
        break;
      case 'annually':
        newCloseDate = addYears(closeDate, 1);
        newSettlementDate = addYears(settlementDate, 1);
        break;
      default:
        // For non-recurring, just add 7 days
        newCloseDate = addDays(closeDate, 7);
        newSettlementDate = addDays(settlementDate, 7);
    }

    // Store duplicate data in sessionStorage for the form to pick up
    const duplicateData = {
      title: event.title,
      description: event.description,
      category: event.category,
      closeDate: newCloseDate.toISOString(),
      settlementDate: newSettlementDate.toISOString(),
      resolution: event.resolution,
      cardStyle: event.card_style,
      recurrenceType: event.recurrence_type,
      tags: event.tags,
      imageUrl: event.image_url,
      yesPrice: event.current_yes_price,
    };

    sessionStorage.setItem('duplicateEventData', JSON.stringify(duplicateData));
    navigate('/admin/events/new?duplicate=true');
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDuplicate}>
      <Copy className="h-4 w-4 mr-2" />
      Duplicar Evento
    </Button>
  );
}
