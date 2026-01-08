-- Corrigir RLS do bcb_data_cache para permitir inserção via service role
-- O service role bypassa RLS por padrão, então as políticas restritivas não afetam
-- Mas precisamos garantir que a edge function consiga inserir

-- Remover políticas restritivas
DROP POLICY IF EXISTS "No direct inserts to BCB cache" ON public.bcb_data_cache;
DROP POLICY IF EXISTS "No direct updates to BCB cache" ON public.bcb_data_cache;
DROP POLICY IF EXISTS "No direct deletes from BCB cache" ON public.bcb_data_cache;