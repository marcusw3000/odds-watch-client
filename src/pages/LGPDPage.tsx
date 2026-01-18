import { Link } from 'react-router-dom';
import { ChevronLeft, Scale, Download, UserX, FileEdit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportDataButton } from '@/components/settings/ExportDataButton';
import { useAuth } from '@/hooks/useAuth';

export function LGPDPage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/" className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Scale className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">LGPD - Seus Direitos</h1>
          <p className="text-sm text-muted-foreground">Lei Geral de Proteção de Dados</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="space-y-8">
        {/* Introdução */}
        <section>
          <p className="text-muted-foreground leading-relaxed">
            A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você, titular 
            dos dados, uma série de direitos sobre suas informações pessoais. Nesta página, 
            você pode conhecer e exercer esses direitos.
          </p>
        </section>

        {/* Cards de Direitos */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-primary" />
                Direito de Acesso
              </CardTitle>
              <CardDescription>
                Você pode solicitar informações sobre quais dados pessoais tratamos sobre você.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings?tab=privacy">Ver meus dados</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileEdit className="h-5 w-5 text-primary" />
                Direito de Correção
              </CardTitle>
              <CardDescription>
                Você pode solicitar a correção de dados incompletos, inexatos ou desatualizados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/profile">Editar perfil</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-5 w-5 text-primary" />
                Direito de Portabilidade
              </CardTitle>
              <CardDescription>
                Você pode exportar seus dados em formato estruturado para uso próprio ou transferência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <ExportDataButton />
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/auth">Faça login para exportar</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserX className="h-5 w-5 text-primary" />
                Direito de Eliminação
              </CardTitle>
              <CardDescription>
                Você pode solicitar a exclusão dos seus dados pessoais da plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings?tab=support">Solicitar exclusão</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Outros Direitos */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Outros Direitos Garantidos</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Revogação de Consentimento</h3>
              <p className="text-sm text-muted-foreground">
                Você pode revogar o consentimento para tratamento de dados a qualquer momento. 
                Note que isso pode impactar sua capacidade de usar certos recursos da plataforma.
              </p>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Oposição ao Tratamento</h3>
              <p className="text-sm text-muted-foreground">
                Você pode se opor ao tratamento de seus dados quando baseado em interesse 
                legítimo, em caso de descumprimento da lei.
              </p>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Informação sobre Compartilhamento</h3>
              <p className="text-sm text-muted-foreground">
                Você tem direito a saber com quais entidades seus dados são compartilhados. 
                Consulte nossa{' '}
                <Link to="/privacidade" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>{' '}
                para detalhes.
              </p>
            </div>
          </div>
        </section>

        {/* DPO */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Encarregado de Dados (DPO)</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground leading-relaxed">
                Para exercer qualquer dos seus direitos ou esclarecer dúvidas sobre o 
                tratamento de seus dados pessoais, você pode entrar em contato com nosso 
                Encarregado de Proteção de Dados através do canal de{' '}
                <Link to="/settings?tab=support" className="text-primary hover:underline">
                  Suporte
                </Link>.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Responderemos às suas solicitações no prazo de até 15 dias, conforme 
                estabelecido pela LGPD.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Links Úteis */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Links Úteis</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/termos">Termos de Uso</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/privacidade">Política de Privacidade</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=support">Suporte</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://www.gov.br/anpd/pt-br" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                ANPD - Autoridade Nacional
              </a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
