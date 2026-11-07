import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePolymarketFavorites } from "@/hooks/usePolymarketFavorites";
import { useAuth } from "@/hooks/useAuth";

export function PolymarketFavoritesPage() {
  const { user } = useAuth();
  const { isLoading, toggleFavorite, favorites } = usePolymarketFavorites();

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
      {isLoading ? <p>Carregando...</p> : favorites.length ? (
        <div className="space-y-2">
          {favorites.map(({ market_id }) => <Card key={market_id}><CardContent className="flex items-center justify-between gap-3 p-4"><Link className="font-medium text-primary hover:underline" to={`/polymarket/market/${market_id}`}>Mercado #{market_id}</Link><Button variant="outline" size="sm" onClick={() => toggleFavorite(market_id)}>Remover</Button></CardContent></Card>)}
        </div>
      ) : <Card><CardContent className="p-6 text-muted-foreground">Nenhum favorito salvo.</CardContent></Card>}
      <Button variant="outline" asChild><Link to="/polymarket">Explorar mercados</Link></Button>
    </section>
  );
}
