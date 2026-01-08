-- Corrigir search_path das funções
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Corrigir política permissiva do bcb_data_cache (apenas service role pode gerenciar)
DROP POLICY IF EXISTS "Service role can manage BCB cache" ON public.bcb_data_cache;

-- Política mais restritiva para bcb_data_cache - ninguém insere diretamente
CREATE POLICY "No direct inserts to BCB cache" ON public.bcb_data_cache
  FOR INSERT WITH CHECK (false);

CREATE POLICY "No direct updates to BCB cache" ON public.bcb_data_cache
  FOR UPDATE USING (false);

CREATE POLICY "No direct deletes from BCB cache" ON public.bcb_data_cache
  FOR DELETE USING (false);