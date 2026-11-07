import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { PolymarketPublicComment } from "@/services/PolymarketPublicComments.server";

interface SiteComment { id: string; user_id: string; author_name: string; content: string; created_at: string; }

export function PolymarketEventComments({ eventId, external, externalError }: { eventId: string; external: PolymarketPublicComment[]; externalError: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [tab, setTab] = useState("site");
  const key = ["polymarket-event-comments", eventId] as const;
  const query = useQuery({ queryKey: key, enabled: tab === "site", queryFn: async (): Promise<SiteComment[]> => {
    const { data, error } = await (supabase as any).from("polymarket_event_comments").select("id,user_id,author_name,content,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  } });
  const add = useMutation({ mutationFn: async (content: string) => {
    const { error } = await (supabase as any).from("polymarket_event_comments").insert({ event_id: eventId, content });
    if (error) throw error;
  }, onSuccess: async () => { setBody(""); await client.invalidateQueries({ queryKey: key }); } });
  const remove = useMutation({ mutationFn: async (id: string) => {
    const { error } = await (supabase as any).from("polymarket_event_comments").delete().eq("id", id);
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: key }) });
  const report = useMutation({ mutationFn: async (id: string) => {
    const { error } = await (supabase as any).from("polymarket_comment_reports").insert({ comment_id: id, reason: "other" });
    if (error) throw error;
  } });

  return <section className="space-y-4 border-t border-border pt-6" aria-label="Comentários do evento">
    <h2 className="text-lg font-semibold">Comentários</h2>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="site">Comunidade do site</TabsTrigger><TabsTrigger value="polymarket">Polymarket</TabsTrigger></TabsList>
      <TabsContent value="site" className="space-y-4 pt-3">
        {user ? <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const content = body.trim(); if (content && content.length <= 1000 && !add.isPending) add.mutate(content); }}><label htmlFor="event-comment" className="sr-only">Seu comentário</label><Textarea id="event-comment" maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Participe da conversa sobre este evento" /><div className="flex justify-between text-xs text-muted-foreground"><span>{body.length}/1000</span><Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>{add.isPending ? "Publicando..." : "Publicar"}</Button></div></form> : <p className="text-sm text-muted-foreground"><Link className="text-primary hover:underline" to={`/auth?returnTo=${encodeURIComponent(`/polymarket/event/${eventId}`)}`}>Entre</Link> para publicar um comentário no site.</p>}
        {add.isError && <p role="alert" className="text-sm text-destructive">Não foi possível publicar. Verifique sua conexão e aguarde antes de tentar novamente.</p>}
        {remove.isError && <p role="alert" className="text-sm text-destructive">Não foi possível excluir o comentário.</p>}
        {report.isSuccess && <p role="status" className="text-sm text-muted-foreground">Denúncia enviada para análise.</p>}
        {report.isError && <p role="alert" className="text-sm text-destructive">Não foi possível denunciar; talvez você já tenha denunciado este comentário.</p>}
        {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando comentários...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os comentários do site.</p> : query.data?.length ? <div className="divide-y divide-border">{query.data.map((comment) => <article key={comment.id} className="space-y-1 py-4"><div className="flex justify-between gap-3 text-xs text-muted-foreground"><strong className="text-foreground">{comment.author_name}</strong>{user?.id === comment.user_id ? <button type="button" onClick={() => remove.mutate(comment.id)} disabled={remove.isPending} className="hover:text-destructive">Excluir</button> : user && <button type="button" onClick={() => report.mutate(comment.id)} disabled={report.isPending} className="hover:text-destructive">Denunciar</button>}</div><p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p></article>)}</div> : <p className="text-sm text-muted-foreground">Nenhum comentário no site ainda.</p>}
      </TabsContent>
      <TabsContent value="polymarket" className="space-y-3 pt-3"><p className="text-xs text-muted-foreground">Comentários públicos da Polymarket, somente leitura. Links externos não são verificados.</p>{externalError ? <p role="alert" className="text-sm text-destructive">Comentários da Polymarket temporariamente indisponíveis.</p> : external.length ? <div className="divide-y divide-border">{external.map((comment) => <article key={comment.id} className="space-y-1 py-4"><strong className="text-sm">{comment.author}</strong><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.body}</p></article>)}</div> : <p className="text-sm text-muted-foreground">Nenhum comentário público encontrado.</p>}</TabsContent>
    </Tabs>
  </section>;
}
