import { Link } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function PrivacidadePage() {
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
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: Janeiro de 2025</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Dados Coletados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Coletamos os seguintes tipos de dados pessoais:
          </p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Dados fornecidos por você:</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Nome completo e nome de exibição</li>
            <li>Endereço de email</li>
            <li>Senha (armazenada de forma criptografada)</li>
            <li>Foto de perfil (opcional)</li>
            <li>Informações bancárias para saques</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Dados coletados automaticamente:</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Endereço IP e localização aproximada</li>
            <li>Tipo de dispositivo e navegador</li>
            <li>Páginas visitadas e tempo de permanência</li>
            <li>Histórico de transações na plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Como Usamos seus Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Utilizamos seus dados pessoais para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Criar e gerenciar sua conta na plataforma</li>
            <li>Processar transações e pagamentos</li>
            <li>Enviar notificações sobre sua conta e mercados</li>
            <li>Prevenir fraudes e garantir a segurança</li>
            <li>Melhorar nossos serviços e experiência do usuário</li>
            <li>Cumprir obrigações legais e regulatórias</li>
            <li>Enviar comunicações de marketing (com seu consentimento)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Compartilhamento de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos compartilhar seus dados com:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>
              <strong>Processadores de pagamento:</strong> Para processar depósitos e saques 
              (Stripe, PIX)
            </li>
            <li>
              <strong>Provedores de serviços:</strong> Empresas que nos auxiliam na operação 
              (hospedagem, email, analytics)
            </li>
            <li>
              <strong>Autoridades públicas:</strong> Quando exigido por lei ou ordem judicial
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
            <li>Manter você logado em sua conta</li>
            <li>Lembrar suas preferências</li>
            <li>Analisar o uso da plataforma</li>
            <li>Melhorar a performance do site</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Você pode gerenciar as preferências de cookies nas configurações do seu navegador.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Segurança dos Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Implementamos medidas técnicas e organizacionais para proteger seus dados:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Criptografia em trânsito (HTTPS/TLS)</li>
            <li>Criptografia de dados sensíveis em repouso</li>
            <li>Autenticação segura com opção de 2FA</li>
            <li>Controle de acesso baseado em funções</li>
            <li>Monitoramento contínuo de segurança</li>
            <li>Backups regulares e recuperação de desastres</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Seus Direitos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conforme a LGPD, você tem direito a:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou incorretos</li>
            <li>Solicitar a exclusão de seus dados</li>
            <li>Exportar seus dados (portabilidade)</li>
            <li>Revogar consentimento para uso de dados</li>
            <li>Opor-se ao tratamento de dados</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Para exercer esses direitos, acesse a página{' '}
            <Link to="/lgpd" className="text-primary hover:underline">LGPD</Link> ou 
            entre em contato pelo{' '}
            <Link to="/settings?tab=support" className="text-primary hover:underline">Suporte</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Retenção de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Mantemos seus dados pelo tempo necessário para:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>Fornecer os serviços contratados</li>
            <li>Cumprir obrigações legais (mínimo 5 anos para dados fiscais)</li>
            <li>Resolver disputas e exercer nossos direitos</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Após esse período, os dados são anonimizados ou excluídos de forma segura.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Transferência Internacional</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados podem ser processados em servidores localizados fora do Brasil. 
            Nesses casos, garantimos proteções adequadas através de cláusulas contratuais 
            padrão ou outros mecanismos aprovados.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Alterações nesta Política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos atualizar esta política periodicamente. Alterações significativas serão 
            comunicadas por email ou notificação na plataforma. Recomendamos revisar esta 
            página regularmente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para dúvidas sobre privacidade ou exercer seus direitos, entre em contato:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
            <li>
              <Link to="/settings?tab=support" className="text-primary hover:underline">
                Canal de Suporte
              </Link>
            </li>
            <li>
              <Link to="/lgpd" className="text-primary hover:underline">
                Página LGPD
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
