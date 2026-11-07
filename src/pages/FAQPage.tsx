import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function FAQPage() {
  const faqCategories = [
    {
      title: 'Sobre a Plataforma',
      questions: [
        {
          question: 'O que sÃ£o mercados preditivos?',
          answer: `Mercados preditivos sÃ£o instrumentos que agregam opiniÃµes sobre a probabilidade de eventos futuros. 
            Funcionam como uma "bolsa de previsÃµes" onde os participantes compram e vendem contratos baseados 
            em suas expectativas sobre o resultado de eventos reais, como eleiÃ§Ãµes, indicadores econÃ´micos ou eventos esportivos.`,
        },
        {
          question: 'Como funciona a plataforma OddsWatch?',
          answer: `A OddsWatch oferece mercados preditivos onde vocÃª pode comprar contratos "Sim" ou "NÃ£o" sobre 
            eventos futuros. Cada contrato custa entre R$0,01 e R$0,99, refletindo a probabilidade estimada do evento. 
            Se sua previsÃ£o estiver correta quando o evento Ã© resolvido, seu contrato vale R$1,00. Caso contrÃ¡rio, vale R$0,00.`,
        },
        {
          question: 'Isso Ã© aposta ou jogo de azar?',
          answer: `NÃ£o. A OddsWatch Ã© uma plataforma de mercados preditivos para fins informativos e educacionais. 
            Diferente de apostas, mercados preditivos agregam informaÃ§Ã£o e conhecimento coletivo, funcionando como 
            ferramentas de previsÃ£o descentralizada. NÃ£o oferecemos jogos de azar nem cassino.`,
        },
        {
          question: 'Preciso pagar para usar a plataforma?',
          answer: `A criaÃ§Ã£o de conta Ã© gratuita. Para participar dos mercados, vocÃª precisa fazer um depÃ³sito. 
            Cobramos taxas sobre transaÃ§Ãµes conforme descrito na pÃ¡gina de Taxas.`,
        },
      ],
    },
    {
      title: 'Conta e SeguranÃ§a',
      questions: [
        {
          question: 'Como criar uma conta?',
          answer: `Acesse a pÃ¡gina de autenticaÃ§Ã£o, escolha "Criar Conta", preencha seu email e senha. 
            VocÃª tambÃ©m pode criar conta usando sua conta Google. ApÃ³s criar, confirme seu email para ativar a conta.`,
        },
        {
          question: 'Esqueci minha senha, o que fazer?',
          answer: `Na pÃ¡gina de login, clique em "Esqueceu a senha?" e informe seu email. 
            VocÃª receberÃ¡ um link para redefinir sua senha. O link expira em 1 hora.`,
        },
        {
          question: 'O que Ã© autenticaÃ§Ã£o de dois fatores (2FA)?',
          answer: `2FA Ã© uma camada extra de seguranÃ§a. Quando ativado, apÃ³s inserir sua senha, 
            vocÃª precisarÃ¡ informar um cÃ³digo enviado para seu email. Isso protege sua conta 
            mesmo que alguÃ©m descubra sua senha.`,
        },
        {
          question: 'Como ativar o 2FA?',
          answer: `Acesse ConfiguraÃ§Ãµes â†’ SeguranÃ§a e ative a opÃ§Ã£o "AutenticaÃ§Ã£o de dois fatores". 
            Um cÃ³digo de verificaÃ§Ã£o serÃ¡ enviado para seu email para confirmar a ativaÃ§Ã£o.`,
        },
      ],
    },
    {
      title: 'DepÃ³sitos e Saques',
      questions: [
        {
          question: 'Quais mÃ©todos de pagamento sÃ£o aceitos?',
          answer: `Aceitamos PIX (processamento instantÃ¢neo) e cartÃ£o de crÃ©dito via Stripe. 
            PIX Ã© a opÃ§Ã£o recomendada por nÃ£o ter taxas adicionais.`,
        },
        {
          question: 'Qual o valor mÃ­nimo para depÃ³sito?',
          answer: `O depÃ³sito mÃ­nimo Ã© de R$10,00. NÃ£o hÃ¡ limite mÃ¡ximo, mas valores acima de 
            R$5.000 podem requerer verificaÃ§Ã£o adicional.`,
        },
        {
          question: 'Como faÃ§o para sacar meus fundos?',
          answer: `Acesse seu PortfÃ³lio, clique em "Sacar" e informe o valor desejado e sua chave PIX. 
            Saques sÃ£o processados em atÃ© 24 horas Ãºteis.`,
        },
        {
          question: 'HÃ¡ taxas para saque?',
          answer: `Sim, hÃ¡ uma taxa fixa de R$2,00 por saque. O valor mÃ­nimo para saque Ã© R$20,00. 
            Consulte a pÃ¡gina de Taxas para mais detalhes.`,
        },
      ],
    },
    {
      title: 'Mercados e NegociaÃ§Ãµes',
      questions: [
        {
          question: 'Como comprar um contrato?',
          answer: `Navegue atÃ© um mercado de seu interesse, escolha a posiÃ§Ã£o ("Sim" ou "NÃ£o"), 
            informe a quantidade de contratos desejada e confirme a compra. O valor serÃ¡ debitado 
            do seu saldo disponÃ­vel.`,
        },
        {
          question: 'Posso vender meus contratos antes do evento ser resolvido?',
          answer: `Sim! VocÃª pode vender seus contratos a qualquer momento pelo preÃ§o atual de mercado. 
            Isso permite realizar lucros antecipadamente ou limitar perdas se sua expectativa mudar.`,
        },
        {
          question: 'Como os preÃ§os sÃ£o definidos?',
          answer: `Usamos um modelo de formaÃ§Ã£o de mercado automatizado (AMM) baseado no LMSR. 
            Os preÃ§os refletem a oferta e demanda agregada de todos os participantes e representam 
            a probabilidade implÃ­cita do evento.`,
        },
        {
          question: 'O que acontece quando um mercado Ã© resolvido?',
          answer: `Quando o evento ocorre, o mercado Ã© resolvido com base em fontes oficiais. 
            Contratos vencedores valem R$1,00 e os perdedores valem R$0,00. O valor Ã© automaticamente 
            creditado no seu saldo.`,
        },
      ],
    },
    {
      title: 'Taxas',
      questions: [
        {
          question: 'Quais taxas sÃ£o cobradas?',
          answer: `Cobramos taxa de transaÃ§Ã£o sobre compra e venda de contratos (geralmente 2-5% dependendo 
            da liquidez), taxa de saque (R$2,00 fixo) e spread de mercado. NÃ£o hÃ¡ taxa de depÃ³sito via PIX.`,
        },
        {
          question: 'Onde posso ver as taxas detalhadas?',
          answer: `Todas as taxas estÃ£o detalhadas na pÃ¡gina de Taxas, acessÃ­vel pelo menu principal ou 
            rodapÃ© do site.`,
        },
      ],
    },
    {
      title: 'Suporte e Problemas',
      questions: [
        {
          question: 'Como entrar em contato com o suporte?',
          answer: `Acesse ConfiguraÃ§Ãµes â†’ Suporte para abrir um ticket. Nossa equipe responde em atÃ© 
            24 horas Ãºteis. Para assuntos urgentes, priorize o canal de suporte.`,
        },
        {
          question: 'Encontrei um bug, como reportar?',
          answer: `Use a seÃ§Ã£o de SugestÃµes para reportar bugs ou sugerir melhorias. 
            Valorizamos muito o feedback da comunidade!`,
        },
        {
          question: 'Posso contestar a resoluÃ§Ã£o de um mercado?',
          answer: `Sim. ApÃ³s a resoluÃ§Ã£o, hÃ¡ um perÃ­odo de contestaÃ§Ã£o onde vocÃª pode argumentar 
            se acredita que a resoluÃ§Ã£o estÃ¡ incorreta. A contestaÃ§Ã£o serÃ¡ analisada pela equipe.`,
        },
      ],
    },
  ];

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
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Perguntas Frequentes</h1>
          <p className="text-sm text-muted-foreground">Tire suas dÃºvidas sobre a plataforma</p>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="space-y-8">
        {faqCategories.map((category, categoryIndex) => (
          <section key={categoryIndex}>
            <h2 className="text-xl font-semibold mb-4">{category.title}</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {category.questions.map((item, questionIndex) => (
                <AccordionItem
                  key={questionIndex}
                  value={`${categoryIndex}-${questionIndex}`}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}

        <section className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            NÃ£o encontrou o que procurava?
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              to="/settings?tab=support"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Falar com Suporte
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
