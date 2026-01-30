import { jsPDF } from 'jspdf';

interface SlideContent {
  title: string;
  subtitle?: string;
  bullets?: string[];
  highlight?: {
    title: string;
    items: string[];
  };
  footer?: string;
}

// Corporate color palette
const COLORS = {
  primary: [41, 98, 255] as [number, number, number], // Blue
  secondary: [34, 197, 94] as [number, number, number], // Green
  accent: [139, 92, 246] as [number, number, number], // Purple
  dark: [30, 41, 59] as [number, number, number], // Slate dark
  muted: [100, 116, 139] as [number, number, number], // Slate muted
  light: [248, 250, 252] as [number, number, number], // Slate light
  white: [255, 255, 255] as [number, number, number],
};

export function generatePartnershipPDF(): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  const presentationDate = new Date().toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
  });

  // Helper functions
  const addHeader = (pageNum: number, totalPages: number) => {
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.text('OddsWatch - Apresentação para Parceiros', margin, 8);
    doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin, 8, { align: 'right' });
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      '*OddsWatch é um nome de trabalho. Marca, identidade visual e posicionamento são totalmente personalizáveis para parceiros.',
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  const addSlideTitle = (title: string, subtitle?: string) => {
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(title, margin, 35);

    if (subtitle) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.muted);
      doc.text(subtitle, margin, 45);
    }
  };

  const addBullets = (bullets: string[], startY: number, indent = 0) => {
    let y = startY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);

    bullets.forEach((bullet) => {
      const bulletText = `• ${bullet}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth - indent);
      lines.forEach((line: string) => {
        doc.text(line, margin + indent, y);
        y += 7;
      });
    });
    return y;
  };

  const addHighlightBox = (title: string, items: string[], y: number) => {
    const boxHeight = 10 + items.length * 6;
    doc.setFillColor(...COLORS.light);
    doc.setDrawColor(...COLORS.primary);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'FD');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(title, margin + 5, y + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    items.forEach((item, i) => {
      doc.text(`• ${item}`, margin + 5, y + 14 + i * 6);
    });

    return y + boxHeight + 5;
  };

  const totalPages = 15;

  // ===== SLIDE 1: Cover =====
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('OddsWatch', pageWidth / 2, 70, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('(Nome temporário)', pageWidth / 2, 80, { align: 'center' });

  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('Plataforma de Mercados Preditivos', pageWidth / 2, 100, { align: 'center' });
  doc.text('Brasil e Mundo', pageWidth / 2, 110, { align: 'center' });

  doc.setFontSize(14);
  doc.text('Apresentação para Parceiros Estratégicos', pageWidth / 2, 140, { align: 'center' });

  doc.setFontSize(12);
  doc.text(presentationDate, pageWidth / 2, 155, { align: 'center' });

  doc.setFontSize(8);
  doc.text('Nome e identidade visual em processo de definição', pageWidth / 2, pageHeight - 15, { align: 'center' });

  // ===== SLIDE 2: O Fenômeno Global (Kalshi) =====
  doc.addPage();
  addHeader(2, totalPages);
  addSlideTitle('O Fenômeno Global', 'Caso Kalshi');

  let y = 55;
  doc.setFillColor(...COLORS.light);
  doc.setDrawColor(...COLORS.secondary);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 55, 3, 3, 'FD');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text('[BRASIL] CASE DE SUCESSO BRASILEIRO', margin + 5, y + 10);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  const kalshiPoints = [
    'Luana Lopes Lara: Brasileira de 29 anos, co-fundadora da Kalshi',
    'Tornou-se a bilionária self-made mais jovem do mundo (Dezembro 2025)',
    'Kalshi: Avaliada em US$ 11 bilhões após rodada de US$ 1 bilhão (Paradigm)',
    'Único mercado preditivo regulado pela CFTC nos EUA',
  ];
  kalshiPoints.forEach((point, i) => {
    doc.text(`• ${point}`, margin + 5, y + 20 + i * 8);
  });

  y = 120;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  const messageText = '"Uma brasileira revolucionou o mercado americano. Agora trazemos essa inovação de volta para o Brasil - e para o mundo."';
  const messageLines = doc.splitTextToSize(messageText, contentWidth);
  doc.text(messageLines, pageWidth / 2, y, { align: 'center' });

  addFooter();

  // ===== SLIDE 3: O Momento é Agora =====
  doc.addPage();
  addHeader(3, totalPages);
  addSlideTitle('O Momento é Agora', 'Tendência dos EUA chegando ao Brasil');

  y = 55;
  const momentBullets = [
    'Prediction markets são tendência consolidada nos EUA',
    'Kalshi: crescimento exponencial, de US$ 5B para US$ 11B em 2 meses',
    'Polymarket: volumes recordes durante eleições americanas',
    'Oportunidade: O Brasil ainda não tem uma plataforma focada no mercado local',
  ];
  y = addBullets(momentBullets, y);

  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text('"Estamos trazendo para o Brasil, abrasileirando a experiência,', margin, y);
  doc.text('e preparando para expansão global"', margin, y + 8);

  addFooter();

  // ===== SLIDE 4: O Problema =====
  doc.addPage();
  addHeader(4, totalPages);
  addSlideTitle('O Problema');

  y = 55;
  const problemBullets = [
    'Falta de plataformas de mercados preditivos focadas no contexto brasileiro',
    'Indicadores econômicos (SELIC, IPCA, PTAX) sem mecanismos de previsão acessíveis',
    'Eventos globais relevantes sem cobertura localizada',
    'Plataformas existentes são internacionais, em inglês, sem pagamentos locais (PIX)',
    'Público brasileiro interessado, mas sem opções de qualidade',
  ];
  addBullets(problemBullets, y);

  addFooter();

  // ===== SLIDE 5: A Solução =====
  doc.addPage();
  addHeader(5, totalPages);
  addSlideTitle('A Solução', 'Plataforma flexível e personalizável');

  y = 55;
  const solutionBullets = [
    'Plataforma completa de mercados preditivos 100% customizável',
    'Eventos brasileiros E mundiais (economia, política, cultura, esportes)',
    'Interface adaptável, com suporte a múltiplos idiomas',
    'Pagamentos locais (PIX, cartão) + expansão para métodos internacionais',
    '100% personalizável para diferentes mercados e parceiros',
  ];
  y = addBullets(solutionBullets, y);

  y += 10;
  addHighlightBox('PLATAFORMA 100% PERSONALIZAVEL', [
    'Nome e identidade visual: Customizáveis',
    'Tipos de mercado: Configuráveis',
    'Taxas e comissões: Ajustáveis',
    'Módulos: Ativáveis/desativáveis conforme necessidade',
  ], y);

  addFooter();

  // ===== SLIDE 6: Como Funciona =====
  doc.addPage();
  addHeader(6, totalPages);
  addSlideTitle('Como Funciona', 'Algoritmo LMSR - Padrão da indústria');

  y = 55;
  const howItWorksBullets = [
    'Algoritmo LMSR (Logarithmic Market Scoring Rule) - mesmo padrão usado pela Kalshi',
    'Usuários adquirem contratos SIM/NÃO ou multi-opção',
    'Preços refletem probabilidade do evento (R$0,65 = 65% de chance)',
    'Liquidação automática baseada em dados oficiais',
    'Modelo adaptável para diferentes tipos de eventos e mercados',
    'Liquidez garantida pelo market maker algorítmico',
  ];
  addBullets(howItWorksBullets, y);

  addFooter();

  // ===== SLIDE 7: Tipos de Mercado =====
  doc.addPage();
  addHeader(7, totalPages);
  addSlideTitle('Tipos de Mercado', 'Totalmente configurável');

  y = 55;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Mercados Binários', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.text('SIM/NÃO - Exemplos: "SELIC vai subir?" | "Brasil ganha a Copa?"', margin, y + 8);

  y += 25;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Mercados Multi-Opção', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.text('Múltiplas respostas - Exemplos: "Quem será o próximo CEO?" | "Qual país sediará?"', margin, y + 8);

  y += 25;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Múltiplos Vencedores', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.text('Ranking com distribuição proporcional - 1º, 2º, 3º lugares', margin, y + 8);

  y += 25;
  addHighlightBox('> Tipos, categorias e regras totalmente personalizaveis por parceiro', [], y);

  addFooter();

  // ===== SLIDE 8: Diferencial - Eventos Brasileiros e Globais =====
  doc.addPage();
  addHeader(8, totalPages);
  addSlideTitle('Diferencial', 'Eventos Brasileiros e Globais');

  y = 55;
  addHighlightBox('EVENTOS BRASILEIROS E GLOBAIS', [
    'Brasil: SELIC, IPCA, PTAX, eleições, economia',
    'Global: Eleições EUA/Europa, indicadores mundiais, tech',
    'Entretenimento: Premiações, cultura pop, esportes',
    'Corporativo: IPOs, fusões, resultados de empresas',
  ], y);

  y += 50;
  const diffBullets = [
    'Expansão Internacional: Arquitetura preparada para múltiplos países',
    'Localização: Cada mercado pode ter sua própria moeda, idioma e regulamentação',
    'DNA Global: Plataforma pensada desde o início para escalar mundialmente',
  ];
  y = addBullets(diffBullets, y);

  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text('"Do Brasil para o mundo - plataforma com DNA global"', margin, y);

  addFooter();

  // ===== SLIDE 9: Funcionalidades da Plataforma =====
  doc.addPage();
  addHeader(9, totalPages);
  addSlideTitle('Funcionalidades da Plataforma', 'Todos os módulos são configuráveis');

  y = 55;
  // Two columns
  const leftFeatures = [
    'Portfólio pessoal com histórico completo',
    'Sistema de depósito/saque (Stripe + PIX)',
    'Leaderboard e sistema de conquistas',
    'Copy Trading (seguir traders experientes)',
  ];
  const rightFeatures = [
    'Programa de indicação com comissões',
    'Notificações em tempo real',
    'Comentários e interação social',
    'Sugestões de mercados pela comunidade',
  ];

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);

  leftFeatures.forEach((feature, i) => {
    doc.text(`• ${feature}`, margin, y + i * 8);
  });

  rightFeatures.forEach((feature, i) => {
    doc.text(`• ${feature}`, margin + contentWidth / 2, y + i * 8);
  });

  y += 50;
  addHighlightBox('Todos os modulos sao configuraveis e podem ser ativados/desativados', [], y);

  addFooter();

  // ===== SLIDE 10: Painel Administrativo =====
  doc.addPage();
  addHeader(10, totalPages);
  addSlideTitle('Painel Administrativo', 'White-label ready');

  y = 55;
  const adminBullets = [
    'Dashboard com métricas em tempo real',
    'Criação e gerenciamento de mercados (interface intuitiva)',
    'Liquidação automatizada e manual',
    'Sistema financeiro completo (ledger, taxas, receita)',
    'Gerenciamento de usuários e suporte',
    'Logs de auditoria detalhados',
    'White-label ready: visual e funcionalidades personalizáveis',
  ];
  addBullets(adminBullets, y);

  addFooter();

  // ===== SLIDE 11: Modelo de Negócio =====
  doc.addPage();
  addHeader(11, totalPages);
  addSlideTitle('Modelo de Negócio', 'Flexibilidade total');

  y = 55;
  const businessBullets = [
    'Taxa de liquidação: Configurável (exemplo: 0,5% sobre retornos)',
    'Comissões de transação: Ajustáveis por faixas e região',
    'Copy Trading: Modelo de assinatura + percentual sobre performance',
    'Programa de indicação: Parâmetros customizáveis',
    'Flexibilidade total: todos os valores são ajustáveis conforme parceria',
  ];
  y = addBullets(businessBullets, y);

  y += 10;
  addHighlightBox('Modelo comprovado pelo sucesso global da Kalshi e Polymarket', [], y);

  addFooter();

  // ===== SLIDE 12: Tecnologia =====
  doc.addPage();
  addHeader(12, totalPages);
  addSlideTitle('Tecnologia', 'Arquitetura modular e escalável');

  y = 55;
  const techItems = [
    ['Frontend', 'React + TypeScript + Tailwind CSS'],
    ['Backend', 'Supabase (PostgreSQL + Edge Functions)'],
    ['Pagamentos', 'Stripe (cartão + PIX) + integrações adicionais'],
    ['Market Maker', 'Algoritmo LMSR para liquidez automática'],
    ['Tempo Real', 'WebSockets para atualizações instantâneas'],
    ['Arquitetura', 'Modular - fácil de escalar e personalizar'],
  ];

  doc.setFontSize(11);
  techItems.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(`${label}:`, margin, y + i * 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    doc.text(value, margin + 35, y + i * 10);
  });

  addFooter();

  // ===== SLIDE 13: Segurança e Compliance =====
  doc.addPage();
  addHeader(13, totalPages);
  addSlideTitle('Segurança e Compliance', 'Adaptável a diferentes regulamentações');

  y = 55;
  const securityBullets = [
    'Autenticação segura (OAuth 2.0, MFA)',
    'Row Level Security (RLS) no banco de dados',
    'Conformidade LGPD (Brasil) + GDPR-ready (Europa)',
    'Logs de auditoria completos',
    'Termos de uso e políticas personalizáveis por região',
    'Adaptável a diferentes regulamentações internacionais',
    'Criptografia de dados sensíveis',
  ];
  addBullets(securityBullets, y);

  addFooter();

  // ===== SLIDE 14: Roadmap e Expansão =====
  doc.addPage();
  addHeader(14, totalPages);
  addSlideTitle('Roadmap e Expansão');

  y = 55;
  const roadmapItems = [
    ['Fase Atual', 'Plataforma funcional completa (MVP Brasil)'],
    ['Q1 2026', 'Integração automática com APIs de dados (BCB, internacionais)'],
    ['Q2 2026', 'App mobile nativo (iOS + Android)'],
    ['Q3 2026', 'Expansão para mercados de entretenimento e esportes'],
    ['2027', 'Expansão LATAM (Argentina, México, Colômbia)'],
    ['2028', 'Expansão global (Europa, Ásia)'],
  ];

  doc.setFontSize(11);
  roadmapItems.forEach(([phase, description], i) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text(`${phase}:`, margin, y + i * 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    doc.text(description, margin + 30, y + i * 12);
  });

  addFooter();

  // ===== SLIDE 15: Oportunidade de Parceria =====
  doc.addPage();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('Oportunidade de Parceria', pageWidth / 2, 40, { align: 'center' });

  y = 65;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const partnershipPoints = [
    '> Primeiro mover no mercado brasileiro de prediction markets',
    '> Tecnologia pronta, testada e funcionando',
    '> Modelo de negocio validado globalmente (Kalshi)',
    '> Plataforma 100% personalizavel para diferentes parceiros',
    '> Arquitetura preparada para expansao internacional',
    '> Equipe tecnica dedicada e experiente',
  ];

  partnershipPoints.forEach((point, i) => {
    doc.text(point, pageWidth / 2, y + i * 12, { align: 'center' });
  });

  y = 145;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('"Seja nosso parceiro na revolução', pageWidth / 2, y, { align: 'center' });
  doc.text('dos mercados preditivos"', pageWidth / 2, y + 10, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Entre em contato para discutir oportunidades de colaboração', pageWidth / 2, y + 35, { align: 'center' });

  doc.setFontSize(8);
  doc.text(presentationDate, pageWidth / 2, pageHeight - 15, { align: 'center' });

  // Add page numbers to all pages (header was added individually)
  // Save the PDF
  doc.save('OddsWatch_Apresentacao_Parceiros.pdf');
}
