import { Link } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function PrivacidadePage() {
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
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">PolÃ­tica de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Ãšltima atualizaÃ§Ã£o: Janeiro de 2025</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Dados Coletados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Coletamos os seguintes tipos de dados pessoais:
          </p>

          <h3 className="text-lg font-medium mt-4 mb-2">Dados fornecidos por vocÃª:</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Nome completo e nome de exibiÃ§Ã£o</li>
            <li>EndereÃ§o de email</li>
            <li>Senha (armazenada de forma criptografada)</li>
            <li>Foto de perfil (opcional)</li>
            <li>InformaÃ§Ãµes bancÃ¡rias para saques</li>
          </ul>

          <h3 className="text-lg font-medium mt-4 mb-2">Dados coletados automaticamente:</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>EndereÃ§o IP e localizaÃ§Ã£o aproximada</li>
            <li>Tipo de dispositivo e navegador</li>
            <li>PÃ¡ginas visitadas e tempo de permanÃªncia</li>
            <li>HistÃ³rico de transaÃ§Ãµes na plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Como Usamos seus Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Utilizamos seus dados pessoais para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Criar e gerenciar sua conta na plataforma</li>
            <li>Processar transaÃ§Ãµes e pagamentos</li>
            <li>Enviar notificaÃ§Ãµes sobre sua conta e mercados</li>
            <li>Prevenir fraudes e garantir a seguranÃ§a</li>
            <li>Melhorar nossos serviÃ§os e experiÃªncia do usuÃ¡rio</li>
            <li>Cumprir obrigaÃ§Ãµes legais e regulatÃ³rias</li>
            <li>Enviar comunicaÃ§Ãµes de marketing (com seu consentimento)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Compartilhamento de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos compartilhar seus dados com:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>
              <strong>Processadores de pagamento:</strong> Para processar depÃ³sitos e saques
              (Stripe, PIX)
            </li>
            <li>
              <strong>Provedores de serviÃ§os:</strong> Empresas que nos auxiliam na operaÃ§Ã£o
              (hospedagem, email, analytics)
            </li>
            <li>
              <strong>Autoridades pÃºblicas:</strong> Quando exigido por lei ou ordem judicial
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            <strong>Nunca vendemos seus dados pessoais para terceiros.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Cookies e Tecnologias de Rastreamento</h2>
          <p className="text-muted-foreground leading-relaxed">
            Utilizamos cookies e tecnologias similares para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Manter vocÃª logado em sua conta</li>
            <li>Lembrar suas preferÃªncias</li>
            <li>Analisar o uso da plataforma</li>
            <li>Melhorar a performance do site</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            VocÃª pode gerenciar as preferÃªncias de cookies nas configuraÃ§Ãµes do seu navegador.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. SeguranÃ§a dos Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Implementamos medidas tÃ©cnicas e organizacionais para proteger seus dados:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Criptografia em trÃ¢nsito (HTTPS/TLS)</li>
            <li>Criptografia de dados sensÃ­veis em repouso</li>
            <li>AutenticaÃ§Ã£o segura com opÃ§Ã£o de 2FA</li>
            <li>Controle de acesso baseado em funÃ§Ãµes</li>
            <li>Monitoramento contÃ­nuo de seguranÃ§a</li>
            <li>Backups regulares e recuperaÃ§Ã£o de desastres</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Seus Direitos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conforme a LGPD, vocÃª tem direito a:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou incorretos</li>
            <li>Solicitar a exclusÃ£o de seus dados</li>
            <li>Exportar seus dados (portabilidade)</li>
            <li>Revogar consentimento para uso de dados</li>
            <li>Opor-se ao tratamento de dados</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Para exercer esses direitos, acesse a pÃ¡gina{' '}
            <Link to="/lgpd" className="text-primary hover:underline">LGPD</Link> ou
            entre em contato pelo{' '}
            <Link to="/settings?tab=support" className="text-primary hover:underline">Suporte</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. RetenÃ§Ã£o de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Mantemos seus dados pelo tempo necessÃ¡rio para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Fornecer os serviÃ§os contratados</li>
            <li>Cumprir obrigaÃ§Ãµes legais (mÃ­nimo 5 anos para dados fiscais)</li>
            <li>Resolver disputas e exercer nossos direitos</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            ApÃ³s esse perÃ­odo, os dados sÃ£o anonimizados ou excluÃ­dos de forma segura.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. TransferÃªncia Internacional</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados podem ser processados em servidores localizados fora do Brasil.
            Nesses casos, garantimos proteÃ§Ãµes adequadas atravÃ©s de clÃ¡usulas contratuais
            padrÃ£o ou outros mecanismos aprovados.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. AlteraÃ§Ãµes nesta PolÃ­tica</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos atualizar esta polÃ­tica periodicamente. AlteraÃ§Ãµes significativas serÃ£o
            comunicadas por email ou notificaÃ§Ã£o na plataforma. Recomendamos revisar esta
            pÃ¡gina regularmente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para dÃºvidas sobre privacidade ou exercer seus direitos, entre em contato:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>
              <Link to="/settings?tab=support" className="text-primary hover:underline">
                Canal de Suporte
              </Link>
            </li>
            <li>
              <Link to="/lgpd" className="text-primary hover:underline">
                PÃ¡gina LGPD
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
