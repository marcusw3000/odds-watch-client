import { supabase } from '@/integrations/supabase/client';
import type { 
  Referral, 
  ReferralSettings, 
  ReferralStats, 
  AdminReferralStats,
  ReferralCommission,
  ActiveDiscount,
  ReferralWithDetails
} from '@/types/referral';

export class ReferralService {
  /**
   * Generate a new referral code for the user
   */
  static async generateReferralCode(userId: string): Promise<{ code: string | null; error: string | null }> {
    try {
      // Check if user already has a code
      const { data: existing } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', userId)
        .is('referred_id', null)
        .limit(1)
        .single();

      if (existing?.referral_code) {
        return { code: existing.referral_code, error: null };
      }

      // Get settings for default values
      const settings = await this.getSettings();
      
      // Generate new code using database function
      const { data: codeData, error: codeError } = await supabase.rpc('generate_referral_code');
      
      if (codeError) {
        console.error('Error generating code:', codeError);
        return { code: null, error: 'Erro ao gerar código' };
      }

      const code = codeData as string;

      // Insert new referral record
      const { error: insertError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: userId,
          referral_code: code,
          commission_percent: settings?.default_commission_percent ?? 0.10,
          discount_percent: settings?.default_discount_percent ?? 0.50,
          status: 'PENDING'
        });

      if (insertError) {
        console.error('Error inserting referral:', insertError);
        return { code: null, error: 'Erro ao criar código de indicação' };
      }

      return { code, error: null };
    } catch (error) {
      console.error('Error in generateReferralCode:', error);
      return { code: null, error: 'Erro inesperado' };
    }
  }

  /**
   * Get referral by code (for linking new users)
   */
  static async getReferralByCode(code: string): Promise<Referral | null> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code.toUpperCase())
      .eq('status', 'PENDING')
      .is('referred_id', null)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Referral;
  }

  /**
   * Link a new user to a referral code via Edge Function (server-side)
   */
  static async linkReferral(_referredId: string, code: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('link-referral', {
        body: { referral_code: code },
      });

      if (error) {
        console.error('Error linking referral:', error);
        return { success: false, error: 'Erro ao vincular indicação' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in linkReferral:', error);
      return { success: false, error: 'Erro inesperado' };
    }
  }

  /**
   * Get user's referral code
   */
  static async getMyReferralCode(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('referrer_id', userId)
      .is('referred_id', null)
      .limit(1)
      .single();

    return data?.referral_code ?? null;
  }

  /**
   * Get list of users referred by this user
   */
  static async getMyReferrals(userId: string): Promise<Referral[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .not('referred_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      return [];
    }

    return (data as Referral[]) ?? [];
  }

  /**
   * Get referral statistics for user
   */
  static async getReferralStats(userId: string): Promise<ReferralStats> {
    const referrals = await this.getMyReferrals(userId);
    const code = await this.getMyReferralCode(userId);

    const totalReferrals = referrals.length;
    const activatedReferrals = referrals.filter(r => r.status === 'ACTIVATED').length;
    const pendingReferrals = referrals.filter(r => r.status === 'PENDING').length;
    const totalCommissionEarned = referrals.reduce((sum, r) => sum + r.total_commission_earned, 0);

    return {
      totalReferrals,
      activatedReferrals,
      pendingReferrals,
      totalCommissionEarned,
      referralCode: code
    };
  }

  /**
   * Check if user has an active discount from being referred
   */
  static async getActiveDiscount(userId: string): Promise<ActiveDiscount | null> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', userId)
      .eq('status', 'ACTIVATED')
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const referral = data as Referral;
    const now = new Date();
    const expiresAt = referral.discount_expires_at ? new Date(referral.discount_expires_at) : null;

    if (expiresAt && expiresAt > now) {
      return {
        hasDiscount: true,
        discountPercent: referral.discount_percent,
        expiresAt: referral.discount_expires_at,
        referralId: referral.id
      };
    }

    return null;
  }

  /**
   * Get referrer info for a user who was referred
   */
  static async getReferrerForUser(userId: string): Promise<Referral | null> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', userId)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Referral;
  }

  // NOTE: processCommission() was removed — commission processing is handled
  // entirely by the database trigger `process_referral_commission`.

  // ============ ADMIN METHODS ============

  /**
   * Get global referral settings
   */
  static async getSettings(): Promise<ReferralSettings | null> {
    const { data, error } = await supabase
      .from('referral_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching referral settings:', error);
      return null;
    }

    return data as ReferralSettings;
  }

  /**
   * Update global referral settings via Edge Function (admin only)
   */
  static async updateSettings(
    settings: Partial<ReferralSettings>,
    _adminUserId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('update-referral-settings', {
        body: settings,
      });

      if (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: 'Erro ao atualizar configurações' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error in updateSettings:', error);
      return { success: false, error: 'Erro inesperado' };
    }
  }

  /**
   * Get all referrals with user details (admin only)
   */
  static async getAllReferrals(): Promise<ReferralWithDetails[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all referrals:', error);
      return [];
    }

    return (data as ReferralWithDetails[]) ?? [];
  }

  /**
   * Get admin statistics for the referral system
   */
  static async getAdminStats(): Promise<AdminReferralStats> {
    const referrals = await this.getAllReferrals();
    
    const totalCodes = referrals.filter(r => r.referred_id === null).length + 
                       referrals.filter(r => r.referred_id !== null).length;
    const totalActivated = referrals.filter(r => r.status === 'ACTIVATED').length;
    const totalWithReferred = referrals.filter(r => r.referred_id !== null).length;
    const conversionRate = totalCodes > 0 ? (totalActivated / totalCodes) * 100 : 0;
    const totalCommissionsPaid = referrals.reduce((sum, r) => sum + r.total_commission_earned, 0);

    return {
      totalCodes,
      totalActivated,
      conversionRate,
      totalCommissionsPaid
    };
  }

  /**
   * Get commission history (admin only)
   */
  static async getAllCommissions(): Promise<ReferralCommission[]> {
    const { data, error } = await supabase
      .from('referral_commissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commissions:', error);
      return [];
    }

    return (data as ReferralCommission[]) ?? [];
  }
}
