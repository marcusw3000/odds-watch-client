import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          question: 'O que são mercados preditivos?',
          answer: `Mercados preditivos são instrumentos que agregam opiniões sobre a probabilidade de eventos futuros. 
            Funcionam como uma "bolsa de previsões" onde os participantes compram e vendem contratos baseados 
            em suas expectativas sobre o resultado de eventos reais, como eleições, indicadores econômicos ou eventos esportivos.`,
        },
        {
          question: 'Como funciona a plataforma OddsWatch?',
          answer: `A OddsWatch oferece mercados preditivos onde você pode comprar contratos "Sim" ou "Não" sobre 
            eventos futuros. Cada contrato custa entre R$0,01 e R$0,99, refletindo a probabilidade estimada do evento. 
            Se sua previsão estiver correta quando o evento é resolvido, seu contrato vale R$1,00. Caso contrário, vale R$0,00.`,
        },
        {
          question: 'Isso é aposta ou jogo de azar?',
          answer: `Não. A OddsWatch é uma plataforma de mercados preditivos para fins informativos e educacionais. 
            Diferente de apostas, mercados preditivos agregam informação e conhecimento coletivo, funcionando como 
            ferramentas de previsão descentralizada. Não oferecemos jogos de azar nem cassino.`,
        },
        {
          question: 'Preciso pagar para usar a plataforma?',
          answer: `A criação de conta é gratuita. Para participar dos mercados, você precisa fazer um depósito. 
            Cobramos taxas sobre transações conforme descrito na página de Taxas.`,
        },
      ],
    },
    {
      title: 'Conta e Segurança',
      questions: [
        {
          question: 'Como criar uma conta?',
          answer: `Acesse a página de autenticação, escolha "Criar Conta", preencha seu email e senha. 
            Você também pode criar conta usando sua conta Google. Após criar, confirme seu email para ativar a conta.`,
        },
        {
          question: 'Esqueci minha senha, o que fazer?',
          answer: `Na página de login, clique em "Esqueceu a senha?" e informe seu email. 
            Você receberá um link para redefinir sua senha. O link expira em 1 hora.`,
        },
        {
          question: 'O que é autenticação de dois fatores (2FA)?',
          answer: `2FA é uma camada extra de segurança. Quando ativado, após inserir sua senha, 
            você precisará informar um código enviado para seu email. Isso protege sua conta 
            mesmo que alguém descubra sua senha.`,
        },
        {
          question: 'Como ativar o 2FA?',
          answer: `Acesse Configurações → Segurança e ative a opção "Autenticação de dois fatores". 
            Um código de verificação será enviado para seu email para confirmar a ativação.`,
        },
      ],
    },
    {
      title: 'Depósitos e Saques',
      questions: [
        {
          question: 'Quais métodos de pagamento são aceitos?',
          answer: `Aceitamos PIX (processamento instantâneo) e cartão de crédito via Stripe. 
            PIX é a opção recomendada por não ter taxas adicionais.`,
        },
        {
          question: 'Qual o valor mínimo para depósito?',
          answer: `O depósito mínimo é de R$10,00. Não há limite máximo, mas valores acima de 
            R$5.000 podem requerer verificação adicional.`,
        },
        {
          question: 'Como faço para sacar meus fundos?',
          answer: `Acesse seu Portfólio, clique em "Sacar" e informe o valor desejado e sua chave PIX. 
            Saques são processados em até 24 horas úteis.`,
        },
        {
          question: 'Há taxas para saque?',
          answer: `Sim, há uma taxa fixa de R$2,00 por saque. O valor mínimo para saque é R$20,00. 
            Consulte a página de Taxas para mais detalhes.`,
        },
      ],
    },
    {
      title: 'Mercados e Negociações',
      questions: [
        {
          question: 'Como comprar um contrato?',
          answer: `Navegue até um mercado de seu interesse, escolha a posição ("Sim" ou "Não"), 
            informe a quantidade de contratos desejada e confirme a compra. O valor será debitado 
            do seu saldo disponível.`,
        },
        {
          question: 'Posso vender meus contratos antes do evento ser resolvido?',
          answer: `Sim! Você pode vender seus contratos a qualquer momento pelo preço atual de mercado. 
            Isso permite realizar lucros antecipadamente ou limitar perdas se sua expectativa mudar.`,
        },
        {
          question: 'Como os preços são definidos?',
          answer: `Usamos um modelo de formação de mercado automatizado (AMM) baseado no LMSR. 
            Os preços refletem a oferta e demanda agregada de todos os participantes e representam 
            a probabilidade implícita do evento.`,
        },
        {
          question: 'O que acontece quando um mercado é resolvido?',
          answer: `Quando o evento ocorre, o mercado é resolvido com base em fontes oficiais. 
            Contratos vencedores valem R$1,00 e os perdedores valem R$0,00. O valor é automaticamente 
            creditado no seu saldo.`,
        },
      ],
    },
    {
      title: 'Taxas',
      questions: [
        {
          question: 'Quais taxas são cobradas?',
          answer: `Cobramos taxa de transação sobre compra e venda de contratos (geralmente 2-5% dependendo 
            da liquidez), taxa de saque (R$2,00 fixo) e spread de mercado. Não há taxa de depósito via PIX.`,
        },
        {
          question: 'Onde posso ver as taxas detalhadas?',
          answer: `Todas as taxas estão detalhadas na página de Taxas, acessível pelo menu principal ou 
            rodapé do site.`,
        },
      ],
    },
    {
      title: 'Suporte e Problemas',
      questions: [
        {
          question: 'Como entrar em contato com o suporte?',
          answer: `Acesse Configurações → Suporte para abrir um ticket. Nossa equipe responde em até 
            24 horas úteis. Para assuntos urgentes, priorize o canal de suporte.`,
        },
        {
          question: 'Encontrei um bug, como reportar?',
          answer: `Use a seção de Sugestões para reportar bugs ou sugerir melhorias. 
            Valorizamos muito o feedback da comunidade!`,
        },
        {
          question: 'Posso contestar a resolução de um mercado?',
          answer: `Sim. Após a resolução, há um período de contestação onde você pode argumentar 
            se acredita que a resolução está incorreta. A contestação será analisada pela equipe.`,
        },
      ],
    },
  ];

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
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Perguntas Frequentes</h1>
          <p className="text-sm text-muted-foreground">Tire suas dúvidas sobre a plataforma</p>
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

        {/* CTA Final */}
        <section className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Não encontrou o que procurava?
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild>
              <Link to="/settings?tab=support">Falar com Suporte</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/suggestions">Ver Sugestões</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
