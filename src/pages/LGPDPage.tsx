import { Link } from 'react-router-dom';
import { ChevronLeft, Scale, Download, UserX, FileEdit, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportDataButton } from '@/components/settings/ExportDataButton';
import { useAuth } from '@/hooks/useAuth';

export function LGPDPage() {
  const { user } = useAuth();
  const secondaryActionClassName =
    'inline-flex items-center justify-center rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Scale className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">LGPD - Seus Direitos</h1>
          <p className="text-sm text-muted-foreground">Lei Geral de Protecao de Dados</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="space-y-8">
        <section>
          <p className="text-muted-foreground leading-relaxed">
            A Lei Geral de Protecao de Dados (Lei no 13.709/2018) garante a voce, titular
            dos dados, uma serie de direitos sobre suas informacoes pessoais. Nesta pagina,
            voce pode conhecer e exercer esses direitos.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-primary" />
                Direito de Acesso
              </CardTitle>
              <CardDescription>
                Voce pode solicitar informacoes sobre quais dados pessoais tratamos sobre voce.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/settings?tab=privacy" className={secondaryActionClassName}>
                Ver meus dados
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileEdit className="h-5 w-5 text-primary" />
                Direito de Correcao
              </CardTitle>
              <CardDescription>
                Voce pode solicitar a correcao de dados incompletos, inexatos ou desatualizados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/profile" className={secondaryActionClassName}>
                Editar perfil
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-5 w-5 text-primary" />
                Direito de Portabilidade
              </CardTitle>
              <CardDescription>
                Voce pode exportar seus dados em formato estruturado para uso proprio ou transferencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <ExportDataButton />
              ) : (
                <Link to="/auth" className={secondaryActionClassName}>
                  Faca login para exportar
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserX className="h-5 w-5 text-primary" />
                Direito de Eliminacao
              </CardTitle>
              <CardDescription>
                Voce pode solicitar a exclusao dos seus dados pessoais da plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/settings?tab=support" className={secondaryActionClassName}>
                Solicitar exclusao
              </Link>
            </CardContent>
          </Card>
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-4">Outros Direitos Garantidos</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Revogacao de Consentimento</h3>
              <p className="text-sm text-muted-foreground">
                Voce pode revogar o consentimento para tratamento de dados a qualquer momento.
                Note que isso pode impactar sua capacidade de usar certos recursos da plataforma.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Oposicao ao Tratamento</h3>
              <p className="text-sm text-muted-foreground">
                Voce pode se opor ao tratamento de seus dados quando baseado em interesse
                legitimo, em caso de descumprimento da lei.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <h3 className="font-medium mb-2">Informacao sobre Compartilhamento</h3>
              <p className="text-sm text-muted-foreground">
                Voce tem direito a saber com quais entidades seus dados sao compartilhados.
                Consulte nossa{' '}
                <Link to="/privacidade" className="text-primary hover:underline">
                  Politica de Privacidade
                </Link>{' '}
                para detalhes.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Encarregado de Dados (DPO)</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground leading-relaxed">
                Para exercer qualquer dos seus direitos ou esclarecer duvidas sobre o
                tratamento de seus dados pessoais, voce pode entrar em contato com nosso
                Encarregado de Protecao de Dados atraves do canal de{' '}
                <Link to="/settings?tab=support" className="text-primary hover:underline">
                  Suporte
                </Link>.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Responderemos as suas solicitacoes no prazo de ate 15 dias, conforme
                estabelecido pela LGPD.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Links Uteis</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/termos" className={secondaryActionClassName}>
              Termos de Uso
            </Link>
            <Link to="/privacidade" className={secondaryActionClassName}>
              Politica de Privacidade
            </Link>
            <Link to="/settings?tab=support" className={secondaryActionClassName}>
              Suporte
            </Link>
            <a
              href="https://www.gov.br/anpd/pt-br"
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryActionClassName}
            >
              ANPD - Autoridade Nacional
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
