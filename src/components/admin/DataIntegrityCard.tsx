import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Info,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataIntegrityCheck, DataIntegrityIssue } from '@/hooks/useDataIntegrityCheck';

function getSeverityIcon(severity: DataIntegrityIssue['severity']) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'info':
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeverityBadge(severity: DataIntegrityIssue['severity']) {
  switch (severity) {
    case 'critical':
      return <Badge variant="destructive">Crítico</Badge>;
    case 'warning':
      return <Badge variant="outline" className="border-warning text-warning">Aviso</Badge>;
    case 'info':
      return <Badge variant="secondary">Info</Badge>;
  }
}

export function DataIntegrityCard() {
  const { data: issues = [], isLoading } = useDataIntegrityCheck();

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="font-medium">Nenhum problema detectado</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={criticalCount > 0 ? 'border-destructive/50' : 'border-warning/50'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive' : 'text-warning'}`} />
          Problemas Detectados
          <Badge variant={criticalCount > 0 ? 'destructive' : 'outline'} className="ml-auto">
            {issues.length}
          </Badge>
        </CardTitle>
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            {criticalCount > 0 && <span className="text-destructive">{criticalCount} crítico(s)</span>}
            {warningCount > 0 && <span className="text-warning">{warningCount} aviso(s)</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {issues.slice(0, 5).map((issue) => (
          <Link
            key={issue.id}
            to={`/admin/events/${issue.marketId}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {getSeverityIcon(issue.severity)}
              <span className="text-sm truncate max-w-[180px]" title={issue.marketTitle}>
                {issue.marketTitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {issue.description}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
        {issues.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{issues.length - 5} outros problemas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
