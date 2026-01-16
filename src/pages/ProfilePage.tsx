import { useParams } from 'react-router-dom';
import { User, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { 
  usePublicProfile, 
  useMyLeaderboardProfile, 
  useMyStatistics,
  useUpdateLeaderboardProfile,
  useLeaderboard 
} from '@/hooks/useLeaderboard';
import { 
  ProfileHeader, 
  ProfileStats, 
  PublicTradeHistory,
  ProfilePrivacySettings,
  AchievementsWithProgress
} from '@/components/profile';
import type { UserProfile } from '@/types/leaderboard';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  
  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  // Hooks for own profile
  const { data: myProfile, isLoading: isLoadingMyProfile } = useMyLeaderboardProfile();
  const { data: myStats, isLoading: isLoadingMyStats } = useMyStatistics();
  const updateProfile = useUpdateLeaderboardProfile();

  // Hook for public profile (other users)
  const { data: publicProfile, isLoading: isLoadingPublicProfile } = usePublicProfile(
    isOwnProfile ? undefined : userId
  );

  // Get leaderboard to find rank
  const { data: leaderboardData } = useLeaderboard('profit', 100);

  const isLoading = isOwnProfile 
    ? (isLoadingMyProfile || isLoadingMyStats) 
    : isLoadingPublicProfile;

  // Build unified profile object
  const profile: UserProfile | null = isOwnProfile
    ? (myProfile && myStats ? {
        id: myProfile.user_id,
        email: null,
        full_name: null,
        avatar_url: null,
        display_name: myProfile.display_name,
        bio: myProfile.bio,
        is_public: myProfile.is_public,
        show_profit: myProfile.show_profit,
        show_roi: myProfile.show_roi,
        show_volume: myProfile.show_volume,
        show_trades: myProfile.show_trades,
        total_profit: myStats.total_profit,
        roi_percent: myStats.roi_percent,
        total_volume: myStats.total_volume,
        total_trades: myStats.total_trades,
        winning_trades: myStats.winning_trades,
        current_streak: myStats.current_streak,
        best_streak: myStats.best_streak,
        best_trade_profit: myStats.best_trade_profit,
        created_at: myProfile.created_at || '',
        updated_at: myProfile.updated_at || '',
      } : null)
    : (publicProfile ? {
        id: publicProfile.id || '',
        email: null,
        full_name: null,
        avatar_url: publicProfile.avatar_url,
        display_name: publicProfile.display_name,
        bio: publicProfile.bio,
        is_public: publicProfile.is_public ?? false,
        show_profit: publicProfile.show_profit ?? true,
        show_roi: publicProfile.show_roi ?? true,
        show_volume: publicProfile.show_volume ?? true,
        show_trades: publicProfile.show_trades ?? true,
        total_profit: publicProfile.total_profit ?? 0,
        roi_percent: publicProfile.roi_percent ?? 0,
        total_volume: publicProfile.total_volume ?? 0,
        total_trades: publicProfile.total_trades ?? 0,
        winning_trades: publicProfile.winning_trades ?? 0,
        current_streak: publicProfile.current_streak ?? 0,
        best_streak: publicProfile.best_streak ?? 0,
        best_trade_profit: publicProfile.best_trade_profit ?? 0,
        created_at: publicProfile.created_at || '',
        updated_at: publicProfile.updated_at || '',
      } : null);

  // Find rank in leaderboard
  const rank = leaderboardData?.find(
    (entry) => entry.user_id === targetUserId
  )?.rank;

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    try {
      await updateProfile.mutateAsync(updates);
      toast.success('Perfil atualizado!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
      throw error;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  // Not logged in for own profile
  if (isOwnProfile && !user) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Faça login para ver seu perfil</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile not found
  if (!profile) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Perfil não encontrado</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Private profile (viewing someone else's)
  if (!isOwnProfile && !profile.is_public) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <ProfileHeader
          profile={profile}
          rank={rank}
          isOwnProfile={false}
        />
        <Card className="bg-muted/30">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Perfil privado</p>
              <p className="text-sm">Este usuário optou por não compartilhar suas informações.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <ProfileHeader
        profile={profile}
        rank={rank}
        isOwnProfile={isOwnProfile}
        onUpdate={isOwnProfile ? handleUpdateProfile : undefined}
      />

      {/* Tabs */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6">
          <ProfileStats profile={profile} isOwnProfile={isOwnProfile} />
        </TabsContent>

        <TabsContent value="achievements" className="mt-6">
          <AchievementsWithProgress />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <PublicTradeHistory
            userId={targetUserId || ''}
            profile={profile}
            isOwnProfile={isOwnProfile}
          />
        </TabsContent>
      </Tabs>

      {/* Privacy Settings (own profile only) */}
      {isOwnProfile && (
        <ProfilePrivacySettings
          profile={profile}
          onUpdate={handleUpdateProfile}
        />
      )}
    </div>
  );
}
