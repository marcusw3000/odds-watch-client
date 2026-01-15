import { Calculator, Info, ArrowDownToLine, ArrowUpFromLine, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function FeesPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary">
            <Calculator className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Transparência de Taxas</h1>
            <p className="text-muted-foreground">Entenda como nossas taxas funcionam</p>
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Acreditamos na transparência total. Aqui você encontra todas as informações sobre como as taxas 
          são calculadas em nossa plataforma.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="border-success/20 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownToLine className="h-4 w-4 text-success" />
              Depósitos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">0%</p>
            <p className="text-xs text-muted-foreground">Sem taxas de depósito</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpFromLine className="h-4 w-4 text-success" />
              Saques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">0%</p>
            <p className="text-xs text-muted-foreground">Sem taxas de saque</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-success" />
              Trading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">0%</p>
            <p className="text-xs text-muted-foreground">Sem taxas de trading</p>
          </CardContent>
        </Card>
      </div>

      {/* Zero Fees Info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-success" />
            Plataforma 100% Sem Taxas
          </CardTitle>
          <CardDescription>
            Negocie livremente sem se preocupar com custos ocultos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <h4 className="font-medium text-sm mb-2">Depósitos Gratuitos</h4>
              <p className="text-xs text-muted-foreground">
                Deposite qualquer valor via PIX sem nenhuma taxa. O valor integral é creditado na sua conta.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <h4 className="font-medium text-sm mb-2">Saques Gratuitos</h4>
              <p className="text-xs text-muted-foreground">
                Retire seus fundos a qualquer momento sem penalidades. Processamento via PIX em até 24h úteis.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <h4 className="font-medium text-sm mb-2">Trading Gratuito</h4>
              <p className="text-xs text-muted-foreground">
                Compre e venda contratos sem taxas. Seu lucro é 100% seu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Perguntas Frequentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Como a plataforma se sustenta sem cobrar taxas?</AccordionTrigger>
              <AccordionContent>
                Estamos em fase de crescimento e priorizamos a experiência do usuário. 
                Nosso modelo de negócio está focado em atrair e reter usuários oferecendo 
                as melhores condições do mercado.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Por que não há taxa de saque?</AccordionTrigger>
              <AccordionContent>
                Acreditamos que você deve ter acesso livre ao seu dinheiro. Removemos todas as taxas 
                de saque para que você possa retirar seus fundos a qualquer momento sem penalidades. 
                O processamento é feito via PIX em até 24 horas úteis.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Há taxas na liquidação de mercados?</AccordionTrigger>
              <AccordionContent>
                Não. Quando um mercado é resolvido (liquidado), não há cobrança de taxas. 
                Se você tiver contratos vencedores, receberá o valor integral (R$1.00 por contrato vencedor) 
                sem nenhuma dedução.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>As taxas podem mudar no futuro?</AccordionTrigger>
              <AccordionContent>
                Qualquer mudança na política de taxas será comunicada com antecedência aos usuários. 
                Nosso compromisso é manter as taxas as mais baixas possíveis do mercado.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Bottom Note */}
      <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border text-center">
        <p className="text-sm text-muted-foreground">
          Dúvidas sobre taxas? Entre em contato conosco através do suporte.
        </p>
      </div>
    </div>
  );
}