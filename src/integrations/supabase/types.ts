export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          points: number
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          points?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          points?: number
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      bcb_data_cache: {
        Row: {
          fetched_at: string
          id: string
          indicator: string
          raw_response: Json | null
          reference_date: string
          value: number
        }
        Insert: {
          fetched_at?: string
          id?: string
          indicator: string
          raw_response?: Json | null
          reference_date: string
          value: number
        }
        Update: {
          fetched_at?: string
          id?: string
          indicator?: string
          raw_response?: Json | null
          reference_date?: string
          value?: number
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          action_taken: string | null
          comment_id: string
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          action_taken?: string | null
          comment_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          action_taken?: string | null
          comment_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_hidden: boolean | null
          likes_count: number | null
          market_id: string
          mentions: string[] | null
          parent_id: string | null
          replies_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          likes_count?: number | null
          market_id: string
          mentions?: string[] | null
          parent_id?: string | null
          replies_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          likes_count?: number | null
          market_id?: string
          mentions?: string[] | null
          parent_id?: string | null
          replies_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contestations: {
        Row: {
          admin_notes: string | null
          created_at: string
          evidence_url: string | null
          id: string
          market_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          market_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          market_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contestations_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_policy_snapshots: {
        Row: {
          applied_flat: number | null
          applied_mode: string
          applied_percent: number | null
          applied_tiers: Json | null
          created_at: string
          fee_rule_id: string | null
          id: string
          type: string
        }
        Insert: {
          applied_flat?: number | null
          applied_mode: string
          applied_percent?: number | null
          applied_tiers?: Json | null
          created_at?: string
          fee_rule_id?: string | null
          id?: string
          type: string
        }
        Update: {
          applied_flat?: number | null
          applied_mode?: string
          applied_percent?: number | null
          applied_tiers?: Json | null
          created_at?: string
          fee_rule_id?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_policy_snapshots_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "fee_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_rules: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          flat_value: number | null
          id: string
          is_active: boolean
          max_fee: number | null
          min_fee: number | null
          mode: string
          name: string
          percent_value: number | null
          tiers: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          flat_value?: number | null
          id?: string
          is_active?: boolean
          max_fee?: number | null
          min_fee?: number | null
          mode: string
          name: string
          percent_value?: number | null
          tiers?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          flat_value?: number | null
          id?: string
          is_active?: boolean
          max_fee?: number | null
          min_fee?: number | null
          mode?: string
          name?: string
          percent_value?: number | null
          tiers?: Json | null
          type?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          direction: string
          fee_amount: number
          fee_snapshot_id: string | null
          id: string
          meta: Json | null
          net_amount: number
          platform_revenue: number
          ref_id: string | null
          ref_type: string
          status: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          direction: string
          fee_amount?: number
          fee_snapshot_id?: string | null
          id?: string
          meta?: Json | null
          net_amount: number
          platform_revenue?: number
          ref_id?: string | null
          ref_type: string
          status?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          fee_amount?: number
          fee_snapshot_id?: string | null
          id?: string
          meta?: Json | null
          net_amount?: number
          platform_revenue?: number
          ref_id?: string | null
          ref_type?: string
          status?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_fee_snapshot_id_fkey"
            columns: ["fee_snapshot_id"]
            isOneToOne: false
            referencedRelation: "fee_policy_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets_with_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      market_options: {
        Row: {
          created_at: string
          current_price: number
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          label: string
          market_id: string
          shares: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_price?: number
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          label: string
          market_id: string
          shares?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_price?: number
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          label?: string
          market_id?: string
          shares?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_options_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_settlements: {
        Row: {
          api_response: Json | null
          api_value: number | null
          id: string
          is_automatic: boolean
          market_id: string
          result: string
          settled_at: string
          settled_by: string | null
          source: string
        }
        Insert: {
          api_response?: Json | null
          api_value?: number | null
          id?: string
          is_automatic?: boolean
          market_id: string
          result: string
          settled_at?: string
          settled_by?: string | null
          source: string
        }
        Update: {
          api_response?: Json | null
          api_value?: number | null
          id?: string
          is_automatic?: boolean
          market_id?: string
          result?: string
          settled_at?: string
          settled_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_settlements_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string
          close_date: string | null
          contract_unit_cost: number
          created_at: string
          current_no_price: number
          current_yes_price: number
          description: string | null
          halt_reason: string | null
          id: string
          image_position_x: number | null
          image_position_y: number | null
          image_url: string | null
          image_zoom: number | null
          liquidity_pool: number
          lmsr_b: number
          market_type: string
          no_shares: number
          options_exclusive: boolean
          resolution: Json | null
          result: string | null
          result_source: string | null
          settled_by: string | null
          settlement_config: Json | null
          settlement_date: string | null
          settlement_type: Database["public"]["Enums"]["settlement_type"]
          status: Database["public"]["Enums"]["market_status"]
          tags: string[] | null
          title: string
          total_volume: number
          updated_at: string
          yes_shares: number
        }
        Insert: {
          category?: string
          close_date?: string | null
          contract_unit_cost?: number
          created_at?: string
          current_no_price?: number
          current_yes_price?: number
          description?: string | null
          halt_reason?: string | null
          id?: string
          image_position_x?: number | null
          image_position_y?: number | null
          image_url?: string | null
          image_zoom?: number | null
          liquidity_pool?: number
          lmsr_b?: number
          market_type?: string
          no_shares?: number
          options_exclusive?: boolean
          resolution?: Json | null
          result?: string | null
          result_source?: string | null
          settled_by?: string | null
          settlement_config?: Json | null
          settlement_date?: string | null
          settlement_type?: Database["public"]["Enums"]["settlement_type"]
          status?: Database["public"]["Enums"]["market_status"]
          tags?: string[] | null
          title: string
          total_volume?: number
          updated_at?: string
          yes_shares?: number
        }
        Update: {
          category?: string
          close_date?: string | null
          contract_unit_cost?: number
          created_at?: string
          current_no_price?: number
          current_yes_price?: number
          description?: string | null
          halt_reason?: string | null
          id?: string
          image_position_x?: number | null
          image_position_y?: number | null
          image_url?: string | null
          image_zoom?: number | null
          liquidity_pool?: number
          lmsr_b?: number
          market_type?: string
          no_shares?: number
          options_exclusive?: boolean
          resolution?: Json | null
          result?: string | null
          result_source?: string | null
          settled_by?: string | null
          settlement_config?: Json | null
          settlement_date?: string | null
          settlement_type?: Database["public"]["Enums"]["settlement_type"]
          status?: Database["public"]["Enums"]["market_status"]
          tags?: string[] | null
          title?: string
          total_volume?: number
          updated_at?: string
          yes_shares?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_market_closing: boolean
          email_market_settled: boolean
          email_marketing: boolean
          email_mentions: boolean | null
          email_weekly_summary: boolean
          id: string
          in_app_achievements: boolean
          in_app_market_updates: boolean
          in_app_social: boolean | null
          in_app_system: boolean
          in_app_trade_updates: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_market_closing?: boolean
          email_market_settled?: boolean
          email_marketing?: boolean
          email_mentions?: boolean | null
          email_weekly_summary?: boolean
          id?: string
          in_app_achievements?: boolean
          in_app_market_updates?: boolean
          in_app_social?: boolean | null
          in_app_system?: boolean
          in_app_trade_updates?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_market_closing?: boolean
          email_market_settled?: boolean
          email_marketing?: boolean
          email_mentions?: boolean | null
          email_weekly_summary?: boolean
          id?: string
          in_app_achievements?: boolean
          in_app_market_updates?: boolean
          in_app_social?: boolean | null
          in_app_system?: boolean
          in_app_trade_updates?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          email_sent: boolean
          id: string
          is_read: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          email_sent?: boolean
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          email_sent?: boolean
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          fee: number
          id: string
          idempotency_key: string | null
          metadata: Json | null
          method: Database["public"]["Enums"]["payment_method"]
          net_amount: number
          pix_code: string | null
          pix_expires_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_qr_code_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          fee?: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          method?: Database["public"]["Enums"]["payment_method"]
          net_amount: number
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_qr_code_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          fee?: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          method?: Database["public"]["Enums"]["payment_method"]
          net_amount?: number
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_qr_code_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          created_at: string
          day: string
          fees: number
          gross: number
          id: string
          net: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          fees?: number
          gross?: number
          id?: string
          net?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          fees?: number
          gross?: number
          id?: string
          net?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          best_streak: number
          best_trade_profit: number
          bio: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_public: boolean
          roi_percent: number
          show_profit: boolean
          show_roi: boolean
          show_trades: boolean
          show_volume: boolean
          total_profit: number
          total_trades: number
          total_volume: number
          updated_at: string
          winning_trades: number
        }
        Insert: {
          avatar_url?: string | null
          best_streak?: number
          best_trade_profit?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_public?: boolean
          roi_percent?: number
          show_profit?: boolean
          show_roi?: boolean
          show_trades?: boolean
          show_volume?: boolean
          total_profit?: number
          total_trades?: number
          total_volume?: number
          updated_at?: string
          winning_trades?: number
        }
        Update: {
          avatar_url?: string | null
          best_streak?: number
          best_trade_profit?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public?: boolean
          roi_percent?: number
          show_profit?: boolean
          show_roi?: boolean
          show_trades?: boolean
          show_volume?: boolean
          total_profit?: number
          total_trades?: number
          total_volume?: number
          updated_at?: string
          winning_trades?: number
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          fee_amount: number
          id: string
          ledger_entry_id: string | null
          referral_id: string
          trade_amount: number
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          fee_amount?: number
          id?: string
          ledger_entry_id?: string | null
          referral_id: string
          trade_amount?: number
        }
        Update: {
          commission_amount?: number
          created_at?: string
          fee_amount?: number
          id?: string
          ledger_entry_id?: string | null
          referral_id?: string
          trade_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          default_commission_percent: number
          default_discount_percent: number
          discount_duration_days: number
          id: string
          is_active: boolean
          min_deposit_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_commission_percent?: number
          default_discount_percent?: number
          discount_duration_days?: number
          id?: string
          is_active?: boolean
          min_deposit_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_commission_percent?: number
          default_discount_percent?: number
          discount_duration_days?: number
          id?: string
          is_active?: boolean
          min_deposit_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          commission_percent: number
          created_at: string
          discount_expires_at: string | null
          discount_percent: number
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
          total_commission_earned: number
        }
        Insert: {
          activated_at?: string | null
          commission_percent?: number
          created_at?: string
          discount_expires_at?: string | null
          discount_percent?: number
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
          total_commission_earned?: number
        }
        Update: {
          activated_at?: string | null
          commission_percent?: number
          created_at?: string
          discount_expires_at?: string | null
          discount_percent?: number
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
          total_commission_earned?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          id: string
          market_id: string
          option_id: string | null
          position: string | null
          price_per_share: number | null
          shares: number | null
          total_amount: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          option_id?: string | null
          position?: string | null
          price_per_share?: number | null
          shares?: number | null
          total_amount: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          option_id?: string | null
          position?: string | null
          price_per_share?: number | null
          shares?: number | null
          total_amount?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contracts: {
        Row: {
          average_price: number
          created_at: string
          id: string
          market_id: string
          option_id: string | null
          position: string
          shares: number
          total_invested: number
          updated_at: string
          user_id: string
        }
        Insert: {
          average_price: number
          created_at?: string
          id?: string
          market_id: string
          option_id?: string | null
          position: string
          shares: number
          total_invested: number
          updated_at?: string
          user_id: string
        }
        Update: {
          average_price?: number
          created_at?: string
          id?: string
          market_id?: string
          option_id?: string | null
          position?: string
          shares?: number
          total_invested?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contracts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_contracts_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_available: number
          balance_locked: number
          created_at: string
          currency: string
          id: string
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          currency?: string
          id?: string
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          currency?: string
          id?: string
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          best_streak: number | null
          best_trade_profit: number | null
          bio: string | null
          created_at: string | null
          current_streak: number | null
          display_name: string | null
          id: string | null
          is_public: boolean | null
          roi_percent: number | null
          show_profit: boolean | null
          show_roi: boolean | null
          show_trades: boolean | null
          show_volume: boolean | null
          total_profit: number | null
          total_trades: number | null
          total_volume: number | null
          updated_at: string | null
          winning_trades: number | null
        }
        Insert: {
          avatar_url?: string | null
          best_streak?: number | null
          best_trade_profit?: number | null
          bio?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          id?: string | null
          is_public?: boolean | null
          roi_percent?: number | null
          show_profit?: boolean | null
          show_roi?: boolean | null
          show_trades?: boolean | null
          show_volume?: boolean | null
          total_profit?: number | null
          total_trades?: number | null
          total_volume?: number | null
          updated_at?: string | null
          winning_trades?: number | null
        }
        Update: {
          avatar_url?: string | null
          best_streak?: number | null
          best_trade_profit?: number | null
          bio?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          id?: string | null
          is_public?: boolean | null
          roi_percent?: number | null
          show_profit?: boolean | null
          show_roi?: boolean | null
          show_trades?: boolean | null
          show_volume?: boolean | null
          total_profit?: number | null
          total_trades?: number | null
          total_volume?: number | null
          updated_at?: string | null
          winning_trades?: number | null
        }
        Relationships: []
      }
      wallets_with_profile: {
        Row: {
          avatar_url: string | null
          balance_available: number | null
          balance_locked: number | null
          created_at: string | null
          currency: string | null
          display_name: string | null
          id: string | null
          total_deposited: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      atomic_deposit_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      atomic_execute_sell: {
        Args: {
          p_contract_id: string
          p_min_value: number
          p_shares: number
          p_user_id: string
        }
        Returns: Json
      }
      atomic_execute_trade: {
        Args: {
          p_market_id: string
          p_max_cost: number
          p_outcome: string
          p_shares: number
          p_user_id: string
        }
        Returns: Json
      }
      atomic_withdraw_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      check_and_grant_achievements: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      check_pending_withdrawal: {
        Args: { p_amount: number; p_pix_key: string; p_user_id: string }
        Returns: boolean
      }
      decrement_comment_likes: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      decrement_replies_count: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_comment_likes: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      increment_replies_count: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      market_status: "OPEN" | "HALTED" | "PENDING" | "CONTESTED" | "SETTLED"
      notification_type:
        | "MARKET_CLOSING_SOON"
        | "MARKET_HALTED"
        | "MARKET_SETTLED"
        | "TRADE_EXECUTED"
        | "ACHIEVEMENT_UNLOCKED"
        | "LEADERBOARD_RANK"
        | "REFERRAL_ACTIVATED"
        | "SYSTEM_ANNOUNCEMENT"
        | "COMMENT_MENTION"
        | "COMMENT_LIKE"
        | "COMMENT_REPLY"
        | "DEPOSIT_CONFIRMED"
        | "WITHDRAWAL_COMPLETED"
        | "WITHDRAWAL_FAILED"
        | "WITHDRAWAL_REQUESTED"
        | "PRICE_ALERT"
      payment_method: "PIX" | "CARD" | "BOLETO"
      payment_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
        | "REFUNDED"
      payment_type: "DEPOSIT" | "WITHDRAWAL"
      settlement_type:
        | "MANUAL"
        | "SELIC"
        | "SELIC_META"
        | "IPCA"
        | "CDI"
        | "PTAX"
        | "PTAX_USD"
        | "PTAX_EUR"
        | "IPCA_12M"
        | "PIB"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      market_status: ["OPEN", "HALTED", "PENDING", "CONTESTED", "SETTLED"],
      notification_type: [
        "MARKET_CLOSING_SOON",
        "MARKET_HALTED",
        "MARKET_SETTLED",
        "TRADE_EXECUTED",
        "ACHIEVEMENT_UNLOCKED",
        "LEADERBOARD_RANK",
        "REFERRAL_ACTIVATED",
        "SYSTEM_ANNOUNCEMENT",
        "COMMENT_MENTION",
        "COMMENT_LIKE",
        "COMMENT_REPLY",
        "DEPOSIT_CONFIRMED",
        "WITHDRAWAL_COMPLETED",
        "WITHDRAWAL_FAILED",
        "WITHDRAWAL_REQUESTED",
        "PRICE_ALERT",
      ],
      payment_method: ["PIX", "CARD", "BOLETO"],
      payment_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      payment_type: ["DEPOSIT", "WITHDRAWAL"],
      settlement_type: [
        "MANUAL",
        "SELIC",
        "SELIC_META",
        "IPCA",
        "CDI",
        "PTAX",
        "PTAX_USD",
        "PTAX_EUR",
        "IPCA_12M",
        "PIB",
      ],
    },
  },
} as const
