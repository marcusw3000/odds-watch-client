import { Calculator, Info, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Scale, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function FeesPage() {
  // Example calculations for the interactive demo
  const examples = [
    { contracts: 10, price: 0.50, description: 'Preço médio (50¢)' },
    { contracts: 25, price: 0.30, description: 'Preço baixo (30¢)' },
    { contracts: 50, price: 0.70, description: 'Preço alto (70¢)' },
    { contracts: 100, price: 0.50, description: 'Grande quantidade (50¢)' },
  ];

  const calculateKalshiFee = (contracts: number, price: number) => {
    const fee = Math.ceil(0.07 * contracts * price * (1 - price) * 100) / 100;
    return fee;
  };

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
          são calculadas em nossa plataforma, seguindo o modelo Kalshi adaptado.
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

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpFromLine className="h-4 w-4 text-orange-500" />
              Saques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">0%</p>
            <p className="text-xs text-muted-foreground">Sem taxas de saque</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">Kalshi</p>
            <p className="text-xs text-muted-foreground">Baseado em ganhos esperados</p>
          </CardContent>
        </Card>
      </div>

      {/* Trading Fee Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Taxa de Trading (Modelo Kalshi)
          </CardTitle>
          <CardDescription>
            Uma taxa variável baseada nos ganhos esperados do contrato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Formula */}
          <div className="p-6 rounded-xl bg-gradient-card border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Fórmula</h3>
            <div className="text-center py-4">
              <code className="text-xl font-mono font-bold text-primary">
                taxa = arredondar↑(0.07 × C × P × (1-P))
              </code>
            </div>
            <div className="grid gap-3 mt-4 text-sm">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="font-mono">C</Badge>
                <span className="text-muted-foreground">Número de contratos sendo negociados</span>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="font-mono">P</Badge>
                <span className="text-muted-foreground">Preço do contrato em reais (50 centavos = 0.50)</span>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="font-mono">P×(1-P)</Badge>
                <span className="text-muted-foreground">Representa o ganho esperado do contrato</span>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="font-mono">arredondar↑</Badge>
                <span className="text-muted-foreground">Arredonda para o próximo centavo</span>
              </div>
            </div>
          </div>

          {/* Examples Table */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Exemplos de Cálculo</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cenário</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Contratos</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Preço (P)</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">P × (1-P)</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((example, i) => {
                    const fee = calculateKalshiFee(example.contracts, example.price);
                    const expectedEarnings = example.price * (1 - example.price);
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-3 px-4 text-sm">{example.description}</td>
                        <td className="py-3 px-4 text-sm text-center font-mono">{example.contracts}</td>
                        <td className="py-3 px-4 text-sm text-center font-mono">R${example.price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm text-center font-mono">{expectedEarnings.toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right font-mono font-medium text-primary">R${fee.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Points */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-1">Ordens Taker</h4>
                  <p className="text-xs text-muted-foreground">
                    Taxas são cobradas apenas para ordens imediatamente executadas (taker). 
                    Ordens que ficam no book não pagam taxa.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-1">Taxa Máxima</h4>
                  <p className="text-xs text-muted-foreground">
                    O valor P×(1-P) é máximo em P=0.50 (25%), diminuindo para preços extremos. 
                    Isso beneficia trades de alta convicção.
                  </p>
                </div>
              </div>
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
              <AccordionTrigger>Por que usamos o modelo Kalshi?</AccordionTrigger>
              <AccordionContent>
                O modelo Kalshi é amplamente reconhecido como o mais justo para mercados de previsão. 
                Ele cobra taxas proporcionais aos ganhos esperados, não ao valor total da transação. 
                Isso significa que trades com alta probabilidade (perto de 0 ou 100%) pagam menos taxa, 
                enquanto trades mais incertos (perto de 50%) pagam um pouco mais.
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
              <AccordionTrigger>Como a taxa afeta meu lucro?</AccordionTrigger>
              <AccordionContent>
                A taxa é deduzida do valor total da operação. Por exemplo, se você comprar 10 contratos 
                a R$0.50 cada (custo de R$5.00), a taxa de R$0.18 será adicionada ao custo total (R$5.18). 
                Na venda, a taxa é deduzida do valor recebido.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>O que é uma ordem "taker" vs "maker"?</AccordionTrigger>
              <AccordionContent>
                <strong>Taker:</strong> Ordens que são imediatamente executadas contra ordens existentes no book. 
                Essas pagam a taxa de trading.<br /><br />
                <strong>Maker:</strong> Ordens que são colocadas no book e aguardam execução. 
                Essas não pagam taxa (ajudam a criar liquidez).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Há taxas na liquidação de mercados?</AccordionTrigger>
              <AccordionContent>
                Não. Quando um mercado é resolvido (liquidado), não há cobrança de taxas. 
                Se você tiver contratos vencedores, receberá o valor integral (R$1.00 por contrato vencedor) 
                sem nenhuma dedução.
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
