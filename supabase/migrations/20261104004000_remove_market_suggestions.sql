-- Retira por completo o recurso legado de sugestões de mercados.
-- As tabelas abaixo não são compartilhadas com o catálogo Polymarket nem com trading.

DROP TABLE IF EXISTS public.suggestion_comment_reports;
DROP TABLE IF EXISTS public.suggestion_comment_likes;
DROP TABLE IF EXISTS public.suggestion_comments;
DROP TABLE IF EXISTS public.suggestion_votes;
DROP TABLE IF EXISTS public.market_suggestions;

DROP FUNCTION IF EXISTS public.vote_on_suggestion(uuid, integer);
DROP FUNCTION IF EXISTS public.get_trending_suggestions(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.update_suggestion_comment_count();
DROP FUNCTION IF EXISTS public.update_suggestion_comment_likes();
DROP FUNCTION IF EXISTS public.trigger_notify_admin_new_suggestion_report();

-- Algumas rotinas históricas de conquistas consultam o nome da relação durante
-- a execução. A view vazia evita regressão nessas rotinas sem manter dados,
-- políticas, escrita ou a funcionalidade de sugestões.
CREATE VIEW public.market_suggestions AS
SELECT
  NULL::uuid AS id,
  NULL::uuid AS user_id,
  NULL::text AS status,
  NULL::integer AS score
WHERE false;
