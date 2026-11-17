import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePolymarketFavorites } from "@/hooks/usePolymarketFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useQueries } from "@tanstack/react-query";

export function PolymarketFavoritesPage() {
  const { user } = useAuth();
  const { isLoading, isError, refetch, toggleFavorite, favorites } = usePolymarketFavorites();
  const markets = useQueries({ queries: favorites.map(({ market_id }) => ({
    queryKey: ["favorite-market-details", market_id], staleTime: 60_000, retry: 1,
    queryFn: async (): Promise<{ question: string }> => {
      const response = await fetch(`/api/polymarket/market/${encodeURIComponent(market_id)}/share`);
      if (!response.ok) throw new Error("Mercado indisponível");
      const data = await response.json();
      if (typeof data.question !== "string" || !data.question.trim()) throw new Error("Dados inválidos");
      return data;
    },
  })) });

  if (!user) {
    return (
      <section className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader><CardTitle>Favoritos Polymarket</CardTitle></CardHeader>
          <CardContent><Button asChild><Link to="/auth?returnTo=%2Fpolymarket%2Ffavorites">Entrar</Link></Button></CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div><h1 className="text-3xl font-bold">Meus favoritos Polymarket</h1><p className="text-muted-foreground">Lista pessoal; não envia ordens.</p></div>
      {isLoading ? <p>Carregando...</p> : isError ? <div role="alert"><p>Não foi possível carregar seus favoritos.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : favorites.length ? (
        <div className="space-y-2">
          {favorites.map(({ market_id }, index) => <Card key={market_id}><CardContent className="flex items-center justify-between gap-3 p-4"><div><Link className="font-medium text-primary hover:underline" to={`/polymarket/market/${market_id}`}>{markets[index]?.data?.question ?? `Mercado #${market_id}`}</Link>{markets[index]?.isError && <p className="text-xs text-muted-foreground">Detalhes temporariamente indisponíveis.</p>}</div><Button variant="outline" size="sm" onClick={() => toggleFavorite(market_id)}>Remover</Button></CardContent></Card>)}
        </div>
      ) : <Card><CardContent className="p-6 text-muted-foreground">Nenhum favorito salvo.</CardContent></Card>}
      <Button variant="outline" asChild><Link to="/polymarket">Explorar mercados</Link></Button>
    </section>
  );
}
