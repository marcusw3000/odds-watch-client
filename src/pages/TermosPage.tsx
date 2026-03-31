import { Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function TermosPage() {
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
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Ultima atualizacao: Janeiro de 2025</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Definicoes e Escopo</h2>
          <p className="text-muted-foreground leading-relaxed">
            Bem-vindo a plataforma OddsWatch. Estes Termos de Uso ("Termos") regem o uso de
            nossa plataforma de mercados preditivos, incluindo todos os servicos, recursos e
            funcionalidades oferecidos.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Ao criar uma conta ou utilizar nossos servicos, voce concorda integralmente com
            estes Termos. Se voce nao concordar, por favor nao utilize a plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Elegibilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para utilizar a plataforma, voce deve:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Ter pelo menos 18 anos de idade</li>
            <li>Possuir capacidade legal para celebrar contratos vinculativos</li>
            <li>Nao estar impedido de usar a plataforma por leis aplicaveis</li>
            <li>Fornecer informacoes verdadeiras e precisas durante o cadastro</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Natureza dos Mercados Preditivos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma OddsWatch oferece mercados preditivos para fins informativos e
            educacionais. Os mercados preditivos sao instrumentos que agregam opinioes
            sobre a probabilidade de eventos futuros.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            Importante: Esta plataforma NAO constitui servico financeiro, aposta ou jogo de azar.
            Os contratos adquiridos representam posicoes sobre previsoes de eventos reais.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Regras de Uso da Plataforma</h2>
          <p className="text-muted-foreground leading-relaxed">Ao utilizar a plataforma, voce concorda em:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Nao manipular ou tentar manipular resultados de mercados</li>
            <li>Nao criar multiplas contas para obter vantagens indevidas</li>
            <li>Nao utilizar bots, scripts ou automacoes nao autorizadas</li>
            <li>Nao publicar conteudo ofensivo, ilegal ou que viole direitos de terceiros</li>
            <li>Manter a seguranca de suas credenciais de acesso</li>
            <li>Reportar imediatamente qualquer uso nao autorizado de sua conta</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Propriedade Intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Todo o conteudo da plataforma, incluindo mas nao limitado a textos, graficos,
            logos, icones, imagens, codigo-fonte e software, e de propriedade exclusiva
            da OddsWatch ou de seus licenciadores.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            E proibida a reproducao, distribuicao, modificacao ou uso comercial de qualquer
            conteudo sem autorizacao previa e expressa.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Taxas e Pagamentos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma pode cobrar taxas por determinadas operacoes, incluindo:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Taxas de transacao sobre compra e venda de contratos</li>
            <li>Taxas de saque para transferencias bancarias</li>
            <li>Outras taxas conforme descritas na pagina de Taxas</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            As taxas vigentes estao disponiveis em{' '}
            <Link to="/fees" className="text-primary hover:underline">/fees</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Limitacao de Responsabilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma e fornecida "como esta" e "conforme disponivel". Nao garantimos:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Disponibilidade ininterrupta dos servicos</li>
            <li>Precisao ou confiabilidade das previsoes de mercado</li>
            <li>Resultados financeiros especificos</li>
            <li>Ausencia de erros ou falhas tecnicas</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Em nenhuma circunstancia seremos responsaveis por danos indiretos, incidentais,
            especiais ou consequenciais decorrentes do uso da plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Resolucao de Disputas</h2>
          <p className="text-muted-foreground leading-relaxed">
            Qualquer disputa relacionada a estes Termos sera resolvida primeiramente por
            negociacao direta. Caso nao haja acordo, as partes concordam em submeter a
            disputa a arbitragem ou ao foro da comarca de Sao Paulo/SP.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Modificacoes dos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Reservamo-nos o direito de modificar estes Termos a qualquer momento.
            Alteracoes significativas serao comunicadas por email ou notificacao na plataforma.
            O uso continuado apos as alteracoes constitui aceitacao dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para duvidas sobre estes Termos, entre em contato atraves da secao de{' '}
            <Link to="/settings?tab=support" className="text-primary hover:underline">
              Suporte
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
