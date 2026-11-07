import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LegacyFinancialPage() {
  return <Card><CardHeader><CardTitle>Financeiro legado</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Esta área pertencia aos mercados antigos em BRL e está indisponível para novas operações.</p><p>As operações Paper Trading são simuladas em USD e não representam receita, depósitos ou saldo financeiro.</p></CardContent></Card>;
}
