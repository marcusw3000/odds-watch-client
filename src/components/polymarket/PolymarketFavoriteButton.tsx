import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePolymarketFavorites } from "@/hooks/usePolymarketFavorites";
import { cn } from "@/lib/utils";

export function PolymarketFavoriteButton({ marketId, showLabel = false, className }: { marketId: string; showLabel?: boolean; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFavorite, isMutating, toggleFavorite } = usePolymarketFavorites();
  const saved = isFavorite(marketId);
  function handleClick() {
    if (!user) { navigate(`/auth?returnTo=${encodeURIComponent(`/polymarket/market/${marketId}`)}`); return; }
    toggleFavorite(marketId);
  }
  return <Button type="button" variant={showLabel ? (saved ? "secondary" : "outline") : "ghost"} size={showLabel ? "default" : "icon"}
    className={cn(saved && "text-pink-500 hover:text-pink-600", className)} disabled={isMutating} onClick={handleClick}
    aria-label={saved ? "Remover dos favoritos" : "Adicionar aos favoritos"}>
    <Heart className={cn("h-4 w-4", saved && "fill-current")} />
    {showLabel && <span>{saved ? "Salvo" : "Salvar"}</span>}
  </Button>;
}
