import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Flag, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  MessageSquare,
  Clock,
  Filter,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Shield,
  Trash2,
  EyeOff,
  AlertOctagon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CommentService } from '@/services/CommentService';
import { CommentReport, REPORT_REASONS } from '@/types/comment';
import { Link } from 'react-router-dom';

type ReportStatus = 'all' | 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
type ReportReason = 'all' | 'spam' | 'offensive' | 'misinformation' | 'other';

export function AdminReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<CommentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('PENDING');
  const [reasonFilter, setReasonFilter] = useState<ReportReason>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    reviewed: 0,
    actioned: 0,
    dismissed: 0,
  });
  
  // Action modal
  const [selectedReport, setSelectedReport] = useState<CommentReport | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'none' | 'hidden' | 'deleted' | 'user_warned'>('none');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Preview modal
  const [previewReport, setPreviewReport] = useState<CommentReport | null>(null);

  useEffect(() => {
    loadReports();
  }, [statusFilter, reasonFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await CommentService.getReports(
        statusFilter === 'all' ? undefined : statusFilter,
        reasonFilter === 'all' ? undefined : reasonFilter
      );
      setReports(data);
      
      // Calculate stats
      const allReports = await CommentService.getReports();
      setStats({
        pending: allReports.filter(r => r.status === 'PENDING').length,
        reviewed: allReports.filter(r => r.status === 'REVIEWED').length,
        actioned: allReports.filter(r => r.status === 'ACTIONED').length,
        dismissed: allReports.filter(r => r.status === 'DISMISSED').length,
      });
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as denúncias.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const openActionModal = (report: CommentReport, action: 'none' | 'hidden' | 'deleted' | 'user_warned') => {
    setSelectedReport(report);
    setSelectedAction(action);
    setAdminNotes('');
    setActionModalOpen(true);
  };

  const handleAction = async () => {
    if (!selectedReport) return;
    
    try {
      setProcessing(true);
      
      const newStatus = selectedAction === 'none' ? 'DISMISSED' : 'ACTIONED';
      
      await CommentService.updateReportStatus(
        selectedReport.id,
        newStatus,
        selectedAction,
        selectedReport.source
      );
      
      toast({
        title: 'Denúncia processada',
        description: selectedAction === 'none' 
          ? 'A denúncia foi dispensada.'
          : `Ação "${getActionLabel(selectedAction)}" aplicada com sucesso.`,
      });
      
      setActionModalOpen(false);
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      console.error('Error processing report:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar a denúncia.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'REVIEWED':
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Eye className="h-3 w-3 mr-1" />Revisado</Badge>;
      case 'ACTIONED':
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Ação Tomada</Badge>;
      case 'DISMISSED':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground"><XCircle className="h-3 w-3 mr-1" />Dispensado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: string) => {
    const found = REPORT_REASONS.find(r => r.value === reason);
    return found?.label || reason;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'none': return 'Dispensar';
      case 'hidden': return 'Ocultar comentário';
      case 'deleted': return 'Excluir comentário';
      case 'user_warned': return 'Advertir usuário';
      default: return action;
    }
  };

  const filteredReports = reports.filter(report => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      report.comment?.content?.toLowerCase().includes(query) ||
      report.commentAuthorName?.toLowerCase().includes(query) ||
      report.reporterName?.toLowerCase().includes(query) ||
      report.marketTitle?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" />
            Denúncias de Comentários e Chat
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie denúncias e modere comentários da comunidade
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-yellow-500 transition-colors" onClick={() => setStatusFilter('PENDING')}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pendentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-green-500 transition-colors" onClick={() => setStatusFilter('ACTIONED')}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Com Ação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.actioned}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-muted-foreground transition-colors" onClick={() => setStatusFilter('DISMISSED')}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              Dispensadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">{stats.dismissed}</div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter('all')}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pending + stats.reviewed + stats.actioned + stats.dismissed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por conteúdo, autor, denunciante ou mercado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReportStatus)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="REVIEWED">Revisados</SelectItem>
                  <SelectItem value="ACTIONED">Com Ação</SelectItem>
                  <SelectItem value="DISMISSED">Dispensados</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(v as ReportReason)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Motivos</SelectItem>
                  {REPORT_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma denúncia encontrada</p>
              <p className="text-sm">Não há denúncias correspondentes aos filtros selecionados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Denunciante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="max-w-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={report.source === 'chat' ? 'default' : report.source === 'suggestion' ? 'outline' : 'secondary'} className="text-xs">
                            {report.source === 'chat' ? '💬 Chat' : report.source === 'suggestion' ? 'Sugestão' : 'Mercado'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {report.comment?.content?.slice(0, 50)}
                          {(report.comment?.content?.length || 0) > 50 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>por {report.commentAuthorName || 'Usuário'}</span>
                          {report.marketTitle && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-32">{report.marketTitle}</span>
                            </>
                          )}
                          {report.suggestionTitle && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-32">{report.suggestionTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getReasonLabel(report.reason)}</Badge>
                      {report.description && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-32 truncate">
                          {report.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{report.reporterName || 'Anônimo'}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(report.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Ações <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewReport(report)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {report.source === 'market' && report.comment?.marketId && (
                            <DropdownMenuItem asChild>
                              <Link to={`/market/${report.comment.marketId}`} target="_blank">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver no Mercado
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {report.source === 'suggestion' && report.suggestionId && (
                            <DropdownMenuItem asChild>
                              <Link to={`/suggestions/${report.suggestionId}`} target="_blank">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver na Sugestão
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {report.status === 'PENDING' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openActionModal(report, 'hidden')}>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Ocultar Comentário
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionModal(report, 'deleted')} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Comentário
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionModal(report, 'user_warned')}>
                                <AlertOctagon className="h-4 w-4 mr-2" />
                                Advertir Usuário
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openActionModal(report, 'none')}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Dispensar Denúncia
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={!!previewReport} onOpenChange={() => setPreviewReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Detalhes da Denúncia
            </DialogTitle>
          </DialogHeader>
          
          {previewReport && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Comentário Denunciado</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{previewReport.comment?.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    por {previewReport.commentAuthorName} • {previewReport.marketTitle}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Motivo</p>
                  <Badge variant="secondary">{getReasonLabel(previewReport.reason)}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(previewReport.status)}
                </div>
              </div>
              
              {previewReport.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Descrição do Denunciante</p>
                  <p className="text-sm">{previewReport.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Denunciante</p>
                  <p>{previewReport.reporterName || 'Anônimo'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Data</p>
                  <p>{format(new Date(previewReport.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
              
              {previewReport.actionTaken && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Ação Tomada</p>
                  <Badge>{getActionLabel(previewReport.actionTaken)}</Badge>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewReport(null)}>
              Fechar
            </Button>
            {previewReport?.status === 'PENDING' && (
              <Button onClick={() => {
                setPreviewReport(null);
                openActionModal(previewReport!, 'hidden');
              }}>
                Tomar Ação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction === 'none' ? (
                <><XCircle className="h-5 w-5" /> Dispensar Denúncia</>
              ) : selectedAction === 'hidden' ? (
                <><EyeOff className="h-5 w-5" /> Ocultar Comentário</>
              ) : selectedAction === 'deleted' ? (
                <><Trash2 className="h-5 w-5 text-destructive" /> Excluir Comentário</>
              ) : (
                <><AlertOctagon className="h-5 w-5" /> Advertir Usuário</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === 'none' 
                ? 'A denúncia será marcada como dispensada e nenhuma ação será tomada.'
                : selectedAction === 'hidden'
                ? 'O comentário será ocultado e não aparecerá mais para outros usuários.'
                : selectedAction === 'deleted'
                ? 'O comentário será permanentemente excluído. Esta ação não pode ser desfeita.'
                : 'O usuário receberá uma notificação de advertência.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedReport && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{selectedReport.comment?.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  por {selectedReport.commentAuthorName}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Notas do Admin (opcional)</label>
              <Textarea
                placeholder="Adicione notas sobre esta decisão..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={processing}
              variant={selectedAction === 'deleted' ? 'destructive' : 'default'}
            >
              {processing ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
