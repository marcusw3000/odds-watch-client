-- Permitir que usuários autenticados insiram ledger_entries e fee_policy_snapshots durante trades
-- (o sistema grava em nome do usuário durante operações de trading)

-- Policy para ledger_entries: usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert own ledger entries"
ON public.ledger_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy para fee_policy_snapshots: qualquer usuário autenticado pode inserir
-- (snapshots são criados durante operações de trading)
CREATE POLICY "Authenticated users can insert snapshots"
ON public.fee_policy_snapshots
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Remover policy anterior que só permite admin inserir snapshots
DROP POLICY IF EXISTS "Admins can insert snapshots" ON public.fee_policy_snapshots;

-- Policy para platform_revenue: permitir upsert para sistema de taxas
-- (agregação de receita durante trades)
CREATE POLICY "System can aggregate revenue"
ON public.platform_revenue
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update revenue"
ON public.platform_revenue
FOR UPDATE
USING (auth.uid() IS NOT NULL);