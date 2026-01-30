import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2, Globe, Settings, TrendingUp, Shield, Users, BarChart3 } from 'lucide-react';
import { generatePartnershipPDF } from '@/lib/generatePartnershipPDF';

const slides = [
  { icon: FileText, title: 'Capa', description: 'OddsWatch - Plataforma de Mercados Preditivos' },
  { icon: TrendingUp, title: 'O Fenômeno Global', description: 'Caso Kalshi e Luana Lopes Lara' },
  { icon: TrendingUp, title: 'O Momento é Agora', description: 'Tendência dos EUA chegando ao Brasil' },
  { icon: FileText, title: 'O Problema', description: 'Falta de plataformas locais de mercados preditivos' },
  { icon: Settings, title: 'A Solução', description: 'Plataforma flexível e 100% personalizável' },
  { icon: BarChart3, title: 'Como Funciona', description: 'Algoritmo LMSR - Padrão da indústria' },
  { icon: FileText, title: 'Tipos de Mercado', description: 'Binário, Multi-opção, Múltiplos vencedores' },
  { icon: Globe, title: 'Diferencial', description: 'Eventos Brasileiros e Globais' },
  { icon: Users, title: 'Funcionalidades', description: 'Portfólio, Copy Trading, Leaderboard' },
  { icon: Settings, title: 'Painel Administrativo', description: 'Dashboard completo - White-label ready' },
  { icon: BarChart3, title: 'Modelo de Negócio', description: 'Taxas configuráveis, múltiplas receitas' },
  { icon: Settings, title: 'Tecnologia', description: 'React, Supabase, Stripe, LMSR' },
  { icon: Shield, title: 'Segurança e Compliance', description: 'LGPD, GDPR-ready, RLS, Auditoria' },
  { icon: TrendingUp, title: 'Roadmap', description: 'Expansão Brasil → LATAM → Global' },
  { icon: Users, title: 'Oportunidade de Parceria', description: 'Seja nosso parceiro estratégico' },
];

export function PartnershipPresentationPage() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 100));
      generatePartnershipPDF();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Apresentação para Parceiros
        </h1>
        <p className="text-muted-foreground text-lg">
          OddsWatch - Plataforma de Mercados Preditivos
        </p>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Nome temporário - Identidade visual personalizável
        </p>
      </div>

      {/* Download Button */}
      <div className="flex justify-center mb-8">
        <Button
          size="lg"
          onClick={handleDownload}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Gerando PDF...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Baixar Apresentação (PDF)
            </>
          )}
        </Button>
      </div>

      {/* Slide Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{slide.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{slide.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Highlights Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Plataforma 100% Personalizável
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Nome e identidade visual: Customizáveis</p>
            <p>• Tipos de mercado: Configuráveis</p>
            <p>• Taxas e comissões: Ajustáveis</p>
            <p>• Idiomas e moedas: Expansíveis</p>
            <p>• Módulos: Ativáveis/desativáveis</p>
            <p>• Regulamentação: Adaptável a cada país</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-success" />
              Eventos Brasileiros e Globais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Brasil: SELIC, IPCA, PTAX, eleições</p>
            <p>• Global: Eleições, indicadores mundiais</p>
            <p>• Entretenimento: Premiações, esportes</p>
            <p>• Corporativo: IPOs, fusões, resultados</p>
            <p>• Expansão: LATAM, Europa, Ásia</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          *OddsWatch é um nome de trabalho. Marca, identidade visual e posicionamento
          são totalmente personalizáveis para parceiros.
        </p>
      </div>
    </div>
  );
}

export default PartnershipPresentationPage;
