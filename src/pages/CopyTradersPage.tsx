import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApprovedCopyTraders, useMyCopySubscriptions, useVerifyCopySubscription, useMyTraderStatus } from "@/hooks/useCopyTrade";
import { useAuth } from "@/hooks/useAuth";
import { CopyTraderCard, SubscribeModal, TraderStatusCard } from "@/components/copyTrade";
import { CopyTrader } from "@/types/copyTrade";
import { Loader2, Users, TrendingUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function CopyTradersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTrader, setSelectedTrader] = useState<CopyTrader | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user } = useAuth();
  const { data: traders, isLoading: loadingTraders } = useApprovedCopyTraders();
  const { data: mySubscriptions } = useMyCopySubscriptions();
  const { data: myTraderStatus, isLoading: loadingTraderStatus } = useMyTraderStatus();
  const verifySubscription = useVerifyCopySubscription();
  
  // Get user balance
  const { data: balanceData } = useQuery({
    queryKey: ['user-balance'],
    queryFn: async () => {
      if (!user) return { balance: 0 };
      const { data, error } = await supabase.functions.invoke('get-user-balance');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  
  // Handle Stripe redirect
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifySubscription.mutate(sessionId);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, verifySubscription]);
  
  // Get subscribed trader IDs
  const subscribedTraderIds = new Set(
    mySubscriptions
      ?.filter(sub => sub.status === 'ACTIVE')
      .map(sub => sub.trader_id) || []
  );
  
  // Filter traders by search
  const filteredTraders = traders?.filter(trader => 
    trader.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trader.bio?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  // Stats
  const totalTraders = traders?.length || 0;
  const totalFollowers = traders?.reduce((sum, t) => sum + t.total_followers, 0) || 0;
  
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Copy Traders</h1>
        <p className="text-muted-foreground">
          Siga traders experientes e copie seus trades automaticamente.
        </p>
      </div>
      
      {/* Trader Status Card - only show if user is logged in */}
      {user && (
        <TraderStatusCard 
          traderStatus={myTraderStatus || null} 
          isLoading={loadingTraderStatus} 
        />
      )}
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-gradient-card border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalTraders}</p>
              <p className="text-sm text-muted-foreground">Traders Ativos</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-gradient-card border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalFollowers}</p>
              <p className="text-sm text-muted-foreground">Total Seguidores</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar traders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>
      
      {/* Traders Grid */}
      {loadingTraders ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTraders.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {searchTerm ? 'Nenhum trader encontrado' : 'Nenhum trader disponível'}
          </h3>
          <p className="text-muted-foreground">
            {searchTerm 
              ? 'Tente buscar por outro termo.' 
              : 'Em breve teremos traders disponíveis para você seguir.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTraders.map((trader) => (
            <CopyTraderCard
              key={trader.id}
              trader={trader}
              onSubscribe={setSelectedTrader}
              isSubscribed={subscribedTraderIds.has(trader.id)}
            />
          ))}
        </div>
      )}
      
      {/* Subscribe Modal */}
      <SubscribeModal
        trader={selectedTrader}
        isOpen={!!selectedTrader}
        onClose={() => setSelectedTrader(null)}
        userBalance={balanceData?.balance_available || 0}
      />
    </div>
  );
}
