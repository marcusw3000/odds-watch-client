export type CardStyleType = 'default' | 'buttons' | 'simple' | 'minimal';

export interface CardStyleOption {
  id: CardStyleType;
  name: string;
  description: string;
}

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
