import { Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function TermosPage() {
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
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: Janeiro de 2025</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Definições e Escopo</h2>
          <p className="text-muted-foreground leading-relaxed">
            Bem-vindo à plataforma OddsWatch. Estes Termos de Uso ("Termos") regem o uso de 
            nossa plataforma de mercados preditivos, incluindo todos os serviços, recursos e 
            funcionalidades oferecidos.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Ao criar uma conta ou utilizar nossos serviços, você concorda integralmente com 
            estes Termos. Se você não concordar, por favor não utilize a plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Elegibilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para utilizar a plataforma, você deve:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Ter pelo menos 18 anos de idade</li>
            <li>Possuir capacidade legal para celebrar contratos vinculativos</li>
            <li>Não estar impedido de usar a plataforma por leis aplicáveis</li>
            <li>Fornecer informações verdadeiras e precisas durante o cadastro</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Natureza dos Mercados Preditivos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma OddsWatch oferece mercados preditivos para fins informativos e 
            educacionais. Os mercados preditivos são instrumentos que agregam opiniões 
            sobre a probabilidade de eventos futuros.
          </p>
          <p className="text-muted-foreground leading-relaxed font-medium">
            Importante: Esta plataforma NÃO constitui serviço financeiro, aposta ou jogo de azar. 
            Os contratos adquiridos representam posições sobre previsões de eventos reais.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Regras de Uso da Plataforma</h2>
          <p className="text-muted-foreground leading-relaxed">Ao utilizar a plataforma, você concorda em:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Não manipular ou tentar manipular resultados de mercados</li>
            <li>Não criar múltiplas contas para obter vantagens indevidas</li>
            <li>Não utilizar bots, scripts ou automações não autorizadas</li>
            <li>Não publicar conteúdo ofensivo, ilegal ou que viole direitos de terceiros</li>
            <li>Manter a segurança de suas credenciais de acesso</li>
            <li>Reportar imediatamente qualquer uso não autorizado de sua conta</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Propriedade Intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Todo o conteúdo da plataforma, incluindo mas não limitado a textos, gráficos, 
            logos, ícones, imagens, código-fonte e software, é de propriedade exclusiva 
            da OddsWatch ou de seus licenciadores.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            É proibida a reprodução, distribuição, modificação ou uso comercial de qualquer 
            conteúdo sem autorização prévia e expressa.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Taxas e Pagamentos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma pode cobrar taxas por determinadas operações, incluindo:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Taxas de transação sobre compra e venda de contratos</li>
            <li>Taxas de saque para transferências bancárias</li>
            <li>Outras taxas conforme descritas na página de Taxas</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            As taxas vigentes estão disponíveis em{' '}
            <Link to="/fees" className="text-primary hover:underline">/fees</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Limitação de Responsabilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma é fornecida "como está" e "conforme disponível". Não garantimos:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Disponibilidade ininterrupta dos serviços</li>
            <li>Precisão ou confiabilidade das previsões de mercado</li>
            <li>Resultados financeiros específicos</li>
            <li>Ausência de erros ou falhas técnicas</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Em nenhuma circunstância seremos responsáveis por danos indiretos, incidentais, 
            especiais ou consequenciais decorrentes do uso da plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Resolução de Disputas</h2>
          <p className="text-muted-foreground leading-relaxed">
            Qualquer disputa relacionada a estes Termos será resolvida primeiramente por 
            negociação direta. Caso não haja acordo, as partes concordam em submeter a 
            disputa à arbitragem ou ao foro da comarca de São Paulo/SP.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Modificações dos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Reservamo-nos o direito de modificar estes Termos a qualquer momento. 
            Alterações significativas serão comunicadas por email ou notificação na plataforma. 
            O uso continuado após as alterações constitui aceitação dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para dúvidas sobre estes Termos, entre em contato através da seção de{' '}
            <Link to="/settings?tab=support" className="text-primary hover:underline">
              Suporte
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
