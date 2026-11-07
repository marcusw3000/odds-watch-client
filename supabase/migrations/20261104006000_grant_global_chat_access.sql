-- RLS já limita as mensagens e denúncias ao usuário adequado. Estes grants
-- permitem que o PostgREST execute as políticas para usuários autenticados.
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;
GRANT INSERT ON TABLE public.chat_reports TO authenticated;
