-- O RLS já restringe linhas ao titular. Estas permissões permitem que o
-- PostgREST execute as leituras autenticadas usadas pelo Portfólio.
GRANT SELECT ON TABLE public.user_contracts TO authenticated;
GRANT SELECT ON TABLE public.transactions TO authenticated;
