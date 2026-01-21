export type CardStyleType = 'default' | 'buttons' | 'simple' | 'minimal';

export interface CardStyleOption {
  id: CardStyleType;
  name: string;
  description: string;
}

// Standardized card dimensions for consistent layout
export const CARD_DIMENSIONS = {
  container: 'min-h-[280px] flex flex-col',
  hover: 'hover:scale-[1.01] hover:border-primary/30 hover:shadow-md',
  transition: 'transition-all duration-200',
  borderRadius: 'rounded-xl',
  padding: 'p-4',
  headerHeight: 'min-h-[56px]',
  imageSize: 'w-10 h-10',
  gap: 'gap-4',
} as const;

export const CARD_STYLES: CardStyleOption[] = [
  {
    id: 'default',
    name: 'Lista com Opções',
    description: 'Exibe opções com percentuais e botões Yes/No lado a lado',
  },
  {
    id: 'buttons',
    name: 'Botões Coloridos',
    description: 'Dois botões grandes coloridos com preços em centavos',
  },
  {
    id: 'simple',
    name: 'Simples',
    description: 'Layout minimalista com botões Yes/No e percentual único',
  },
  {
    id: 'minimal',
    name: 'Compacto',
    description: 'Card ultra-compacto com informações essenciais',
  },
];

export const DEFAULT_CARD_STYLE: CardStyleType = 'default';
