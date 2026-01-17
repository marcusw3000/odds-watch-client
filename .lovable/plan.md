# Plano: Conquistas Especiais + Conquistas de Indicacao

## Resumo

Implementar 14 novas conquistas divididas em 2 categorias:
- **8 Conquistas Especiais** (comportamento de trading)
- **6 Conquistas de Indicacao** (sistema de referral)

---

## Parte 1: Conquistas Especiais

| Codigo | Nome | Descricao | Criterio | Pontos |
|--------|------|-----------|----------|--------|
| `prophet_3` | Profeta | Acertou 3 mercados seguidos | markets_won_streak >= 3 | 30 |
| `prophet_5` | Oraculo | Acertou 5 mercados seguidos | markets_won_streak >= 5 | 50 |
| `prophet_10` | Vidente Supremo | Acertou 10 mercados seguidos | markets_won_streak >= 10 | 100 |
| `night_owl` | Coruja Noturna | Fez trade entre 00h e 05h | has_night_trade = true | 20 |
| `early_bird` | Madrugador | Fez trade entre 05h e 07h | has_early_trade = true | 20 |
| `weekend_warrior` | Guerreiro de Fim de Semana | Fez 10 trades no fim de semana | weekend_trades >= 10 | 25 |
| `speed_trader` | Trader Relampago | Comprou e vendeu em menos de 1h | has_speed_trade = true | 15 |
| `contrarian` | Contra a Mare | Comprou quando preco estava abaixo de 20% | has_contrarian_trade = true | 25 |

---

## Parte 2: Conquistas de Indicacao

| Codigo | Nome | Descricao | Criterio | Pontos |
|--------|------|-----------|----------|--------|
| `referral_first` | Primeiro Amigo | Indicou sua primeira pessoa | total_referrals >= 1 | 15 |
| `referral_5` | Influenciador | Indicou 5 pessoas | total_referrals >= 5 | 30 |
| `referral_10` | Embaixador | Indicou 10 pessoas | total_referrals >= 10 | 50 |
| `referral_25` | Lider de Comunidade | Indicou 25 pessoas | total_referrals >= 25 | 100 |
| `referral_activated_5` | Mentor | 5 indicados fizeram deposito | activated_referrals >= 5 | 40 |
| `referral_earnings_100` | Comissao Bronze | Ganhou R$100 em comissoes | total_commission_earned >= 100 | 35 |
| `referral_earnings_500` | Comissao Prata | Ganhou R$500 em comissoes | total_commission_earned >= 500 | 75 |
| `referral_earnings_1000` | Comissao Ouro | Ganhou R$1000 em comissoes | total_commission_earned >= 1000 | 150 |

---

## Alteracoes no Banco de Dados

### 1. Novos campos na tabela `profiles`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  -- Campos para conquistas especiais
  markets_won_streak integer DEFAULT 0,
  best_markets_won_streak integer DEFAULT 0,
  has_night_trade boolean DEFAULT false,
  has_early_trade boolean DEFAULT false,
  weekend_trades integer DEFAULT 0,
  has_speed_trade boolean DEFAULT false,
  has_contrarian_trade boolean DEFAULT false,
  -- Campos para conquistas de indicacao (cache)
  total_referrals integer DEFAULT 0,
  activated_referrals integer DEFAULT 0,
  total_referral_commission numeric DEFAULT 0;
```

### 2. Inserir novas conquistas

```sql
INSERT INTO achievements (code, name, description, icon, category, points) VALUES
  -- Especiais
  ('prophet_3', 'Profeta', 'Acertou 3 mercados seguidos', '', 'special', 30),
  ('prophet_5', 'Oraculo', 'Acertou 5 mercados seguidos', '', 'special', 50),
  ('prophet_10', 'Vidente Supremo', 'Acertou 10 mercados seguidos', '', 'special', 100),
  ('night_owl', 'Coruja Noturna', 'Fez trade entre 00h e 05h', '', 'special', 20),
  ('early_bird', 'Madrugador', 'Fez trade entre 05h e 07h', '', 'special', 20),
  ('weekend_warrior', 'Guerreiro de Fim de Semana', 'Fez 10 trades no fim de semana', '', 'special', 25),
  ('speed_trader', 'Trader Relampago', 'Comprou e vendeu em menos de 1h', '', 'special', 15),
  ('contrarian', 'Contra a Mare', 'Comprou quando preco estava abaixo de 20%', '', 'special', 25),
  -- Indicacao
  ('referral_first', 'Primeiro Amigo', 'Indicou sua primeira pessoa', '', 'referral', 15),
  ('referral_5', 'Influenciador', 'Indicou 5 pessoas', '', 'referral', 30),
  ('referral_10', 'Embaixador', 'Indicou 10 pessoas', '', 'referral', 50),
  ('referral_25', 'Lider de Comunidade', 'Indicou 25 pessoas', '', 'referral', 100),
  ('referral_activated_5', 'Mentor', '5 indicados fizeram deposito', '', 'referral', 40),
  ('referral_earnings_100', 'Comissao Bronze', 'Ganhou R$100 em comissoes', '', 'referral', 35),
  ('referral_earnings_500', 'Comissao Prata', 'Ganhou R$500 em comissoes', '', 'referral', 75),
  ('referral_earnings_1000', 'Comissao Ouro', 'Ganhou R$1000 em comissoes', '', 'referral', 150);
```

### 3. Atualizar `atomic_execute_trade` para rastrear:

- **Horario do trade** (madrugada/manha)
- **Dia da semana** (fim de semana)
- **Preco contrarian** (abaixo de 20%)

### 4. Criar funcao `process_market_settlement_achievements`

Chamada quando um mercado e liquidado para:
- Verificar se usuario ganhou no mercado
- Atualizar `markets_won_streak` e `best_markets_won_streak`
- Resetar streak se perdeu

### 5. Criar trigger para atualizar cache de referrals

Quando uma indicacao e ativada, atualizar os campos de cache na tabela `profiles`.

### 6. Atualizar `check_and_grant_achievements`

Adicionar verificacoes para todas as novas conquistas.

---

## Frontend

### Atualizar `achievementProgress.ts`

Adicionar mapeamento para os novos codigos de conquistas.

### Atualizar `categories` no componente de conquistas

```typescript
const categories = {
  trading: 'Trading',
  profit: 'Lucro',
  streak: 'Sequencia',
  volume: 'Volume',
  leaderboard: 'Ranking',
  special: 'Especial',
  referral: 'Indicacao',  // NOVO
};
```

---

## Fluxo de Verificacao

```
Trade executado
      |
      v
atomic_execute_trade
      |
      +-- Verifica horario (night_owl, early_bird)
      +-- Verifica dia (weekend_warrior)
      +-- Verifica preco (contrarian)
      +-- Atualiza profiles
      +-- check_and_grant_achievements()

Mercado liquidado
      |
      v
process_market_settlement_achievements
      |
      +-- Verifica se usuario ganhou
      +-- Atualiza markets_won_streak
      +-- check_and_grant_achievements()

Referral ativado
      |
      v
Trigger on referrals
      |
      +-- Atualiza profiles (total_referrals, activated_referrals)
      +-- check_and_grant_achievements()
```

---

## Arquivos a Modificar

| Tipo | Arquivo/Acao |
|------|--------------|
| SQL Migration | Adicionar colunas em profiles |
| SQL Migration | Inserir novas conquistas |
| SQL Migration | Atualizar atomic_execute_trade |
| SQL Migration | Criar process_market_settlement_achievements |
| SQL Migration | Criar trigger para referrals |
| SQL Migration | Atualizar check_and_grant_achievements |
| Frontend | Atualizar achievementProgress.ts |
| Frontend | Atualizar AchievementsBadges.tsx (categoria referral) |
| Frontend | Atualizar useLeaderboard.ts (novos campos) |

---

## Resultado Esperado

1. **14 novas conquistas** aparecerao no sistema
2. Conquistas especiais serao concedidas automaticamente ao fazer trades em horarios/condicoes especificas
3. Conquistas de indicacao serao concedidas ao indicar amigos e ganhar comissoes
4. Progress bars funcionais para todas as conquistas
5. Nova categoria "Indicacao" no painel de conquistas