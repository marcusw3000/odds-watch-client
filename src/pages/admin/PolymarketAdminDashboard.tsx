import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PolymarketAdminDashboard() {
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Painel administrativo</h1><p className="mt-1 text-muted-foreground">Administração da plataforma e acompanhamento do catálogo Polymarket.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Catálogo Polymarket</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Consulte os eventos sincronizados e os dados públicos.</p><Button variant="outline" asChild><Link to="/polymarket">Abrir catálogo</Link></Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Sistema</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Consulte as verificações de conexão e disponibilidade.</p><Button variant="outline" asChild><Link to="/admin/system">Abrir monitoramento</Link></Button></CardContent></Card>
    </div>
  </div>;
}
