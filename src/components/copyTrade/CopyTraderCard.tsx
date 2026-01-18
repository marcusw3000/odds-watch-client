import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CopyTrader } from "@/types/copyTrade";
import { TrendingUp, Users, Target, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface CopyTraderCardProps {
  trader: CopyTrader;
  onSubscribe: (trader: CopyTrader) => void;
  isSubscribed?: boolean;
}

export function CopyTraderCard({ trader, onSubscribe, isSubscribed }: CopyTraderCardProps) {
  const winRatePercent = trader.win_rate != null ? (trader.win_rate * 100).toFixed(0) : null;
  
  return (
    <Card className="group relative overflow-hidden border-border/50 bg-gradient-card hover:border-primary/30 transition-all duration-300 hover:shadow-elevated">
      {/* Glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
      </div>
      
      <CardHeader className="pb-4 relative">
        <Link 
          to={`/profile/${trader.user_id}`}
          className="flex items-start gap-4 hover:opacity-90 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="h-14 w-14 border-2 border-primary/20 hover:ring-2 hover:ring-primary/50 transition-all">
            <AvatarImage src={trader.avatar_url || undefined} alt={trader.display_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {trader.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate hover:text-primary transition-colors">
              {trader.display_name}
            </h3>
            {trader.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {trader.bio}
              </p>
            )}
          </div>
        </Link>
      </CardHeader>
      
      <CardContent className="pb-4 relative">
        <div className="grid grid-cols-2 gap-3">
          {/* Win Rate */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-success/10">
              <Target className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="font-semibold text-foreground">
                {winRatePercent != null ? `${winRatePercent}%` : '-'}
              </p>
            </div>
          </div>
          
          {/* Followers */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Seguidores</p>
              <p className="font-semibold text-foreground">{trader.total_followers}</p>
            </div>
          </div>
          
          {/* Total Trades */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-warning/10">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Trades Copiados</p>
              <p className="font-semibold text-foreground">{trader.total_trades_copied}</p>
            </div>
          </div>
          
          {/* Monthly Fee */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-accent">
              <Wallet className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Taxa Mensal</p>
              <p className="font-semibold text-foreground">
                {trader.monthly_fee ? formatCurrency(trader.monthly_fee) : 'Grátis'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Profit Share Badge */}
        {trader.profit_share_percent != null && trader.profit_share_percent > 0 && (
          <div className="mt-3 flex items-center justify-center">
            <Badge variant="outline" className="text-xs border-muted-foreground/30">
              {trader.profit_share_percent}% de participação nos lucros
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0 relative">
        <Button 
          className="w-full" 
          onClick={() => onSubscribe(trader)}
          disabled={isSubscribed}
          variant={isSubscribed ? "outline" : "default"}
        >
          {isSubscribed ? 'Já Inscrito' : 'Seguir Trader'}
        </Button>
      </CardFooter>
    </Card>
  );
}
