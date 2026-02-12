

# Plano: Alinhar PDF com Timeline, Stack e Roadmap Cripto

## Alterações no Arquivo: `src/lib/generatePartnershipPDF.ts`

### 1. Atualizar Slide 12 (Tecnologia) - Linhas 422-428

Substituir os itens genéricos pela stack real detalhada:

| Antes | Depois |
|-------|--------|
| `'React + TypeScript + Tailwind CSS'` | `'React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query, Recharts, Lucide'` |
| `'Supabase (PostgreSQL + Edge Functions)'` | `'Supabase (PostgreSQL + Edge Functions em Deno/TypeScript)'` |
| `'Stripe (cartão + PIX) + integrações adicionais'` | `'Stripe (Payment Intents / Saved Cards) + PIX via Edge Functions'` |
| (manter Market Maker e Tempo Real) | (manter) |
| `'Modular - fácil de escalar e personalizar'` | (manter) |

Adicionar novo item:
- `['Monitoramento', 'Sentry (error tracking) + Web Vitals']`

### 2. Atualizar Slide 14 (Roadmap) - Linhas 468-474

Substituir o roadmap atual pela timeline de lançamento fornecida, mais expansão futura e cripto:

```text
Antes:
  Fase Atual → MVP Brasil
  Q1 2026   → APIs BCB
  Q2 2026   → App mobile
  Q3 2026   → Entretenimento/esportes
  2027      → LATAM
  2028      → Global

Depois:
  Q1 2026   → MVP funcional em ambiente controlado + integrações de dados essenciais
  Q2 2026   → Beta fechado com usuários convidados + melhorias de produto/segurança
  Q3 2026   → Beta público gradual (rollout por coortes) + parcerias iniciais
  2027      → Expansão LATAM (Argentina, México, Colômbia) + app mobile
  2028      → Expansão global (Europa, Ásia) + integração cripto (USDC, Polygon/Solana)
```

A fase atual (Q1 2026) mantém o marcador verde diferenciado.

### 3. Adicionar Roadmap Cripto no Slide 14

Após o roadmap principal, adicionar um highlight box com o roadmap cripto futuro:

```typescript
addHighlightBox('ROADMAP CRIPTO (FUTURO)', [
  'Custódia/ramps: Circle (USDC) e/ou Fireblocks/BitGo',
  'Redes: Ethereum, Polygon, Solana',
  'SDK: ethers.js ou viem',
], y);
```

---

## Resumo

| Slide | Mudança |
|-------|---------|
| 12 - Tecnologia | Stack detalhada real + Monitoramento (Sentry/Web Vitals) |
| 14 - Roadmap | Timeline Q1-Q3 2026 alinhada + expansão 2027-2028 com cripto |
| 14 - Roadmap | Highlight box com roadmap cripto futuro |

