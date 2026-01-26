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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
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
          {
            foreignKeyName: "fk_comments_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      copied_trades: {
        Row: {
          commission_processed: boolean
          copied_amount: number
          copied_price: number | null
          copied_transaction_id: string | null
          created_at: string
          executed_at: string | null
          failure_reason: string | null
          id: string
          is_settled: boolean
          market_id: string
          original_amount: number
          original_price: number
          original_transaction_id: string
          outcome: string
          profit_amount: number | null
          settled_at: string | null
          skip_reason: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          commission_processed?: boolean
          copied_amount: number
          copied_price?: number | null
          copied_transaction_id?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          is_settled?: boolean
          market_id: string
          original_amount: number
          original_price: number
          original_transaction_id: string
          outcome: string
          profit_amount?: number | null
          settled_at?: string | null
          skip_reason?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          commission_processed?: boolean
          copied_amount?: number
          copied_price?: number | null
          copied_transaction_id?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          is_settled?: boolean
          market_id?: string
          original_amount?: number
          original_price?: number
          original_transaction_id?: string
          outcome?: string
          profit_amount?: number | null
          settled_at?: string | null
          skip_reason?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copied_trades_copied_transaction_id_fkey"
            columns: ["copied_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copied_trades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copied_trades_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copied_trades_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "copy_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_subscriptions: {
        Row: {
          auto_copy: boolean
          cancelled_at: string | null
          copy_percentage: number | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          follower_id: string
          id: string
          last_payment_at: string | null
          max_trade_amount: number | null
          monthly_fee_paid: number | null
          payment_method: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_commission_paid: number
          total_profit: number
          total_trades_copied: number
          trader_id: string
          updated_at: string
        }
        Insert: {
          auto_copy?: boolean
          cancelled_at?: string | null
          copy_percentage?: number | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          follower_id: string
          id?: string
          last_payment_at?: string | null
          max_trade_amount?: number | null
          monthly_fee_paid?: number | null
          payment_method?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_commission_paid?: number
          total_profit?: number
          total_trades_copied?: number
          trader_id: string
          updated_at?: string
        }
        Update: {
          auto_copy?: boolean
          cancelled_at?: string | null
          copy_percentage?: number | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          follower_id?: string
          id?: string
          last_payment_at?: string | null
          max_trade_amount?: number | null
          monthly_fee_paid?: number | null
          payment_method?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_commission_paid?: number
          total_profit?: number
          total_trades_copied?: number
          trader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_subscriptions_trader_id_fkey"
            columns: ["trader_id"]
            isOneToOne: false
            referencedRelation: "copy_traders"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_trade_commissions: {
        Row: {
          commission_total: number
          copied_trade_id: string
          created_at: string
          follower_id: string
          id: string
          platform_ledger_id: string | null
          platform_share: number
          platform_split_percent: number
          profit_amount: number
          profit_share_percent: number
          trader_id: string
          trader_ledger_id: string | null
          trader_share: number
          trader_split_percent: number
        }
        Insert: {
          commission_total: number
          copied_trade_id: string
          created_at?: string
          follower_id: string
          id?: string
          platform_ledger_id?: string | null
          platform_share: number
          platform_split_percent: number
          profit_amount: number
          profit_share_percent: number
          trader_id: string
          trader_ledger_id?: string | null
          trader_share: number
          trader_split_percent: number
        }
        Update: {
          commission_total?: number
          copied_trade_id?: string
          created_at?: string
          follower_id?: string
          id?: string
          platform_ledger_id?: string | null
          platform_share?: number
          platform_split_percent?: number
          profit_amount?: number
          profit_share_percent?: number
          trader_id?: string
          trader_ledger_id?: string | null
          trader_share?: number
          trader_split_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "copy_trade_commissions_copied_trade_id_fkey"
            columns: ["copied_trade_id"]
            isOneToOne: false
            referencedRelation: "copied_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_commissions_platform_ledger_id_fkey"
            columns: ["platform_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_commissions_trader_id_fkey"
            columns: ["trader_id"]
            isOneToOne: false
            referencedRelation: "copy_traders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_commissions_trader_ledger_id_fkey"
            columns: ["trader_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_trade_settings: {
        Row: {
          created_at: string | null
          default_monthly_fee: number
          default_platform_split: number
          default_profit_share_percent: number
          default_trader_split: number
          id: string
          max_trader_split: number
          min_trader_split: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          default_monthly_fee?: number
          default_platform_split?: number
          default_profit_share_percent?: number
          default_trader_split?: number
          id?: string
          max_trader_split?: number
          min_trader_split?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          default_monthly_fee?: number
          default_platform_split?: number
          default_profit_share_percent?: number
          default_trader_split?: number
          id?: string
          max_trader_split?: number
          min_trader_split?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      copy_traders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          custom_platform_split: number | null
          custom_trader_split: number | null
          display_name: string
          id: string
          monthly_fee: number | null
          profit_share_percent: number | null
          rejection_reason: string | null
          status: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          suspended_at: string | null
          total_earnings: number
          total_followers: number
          total_trades_copied: number
          updated_at: string
          user_id: string
          win_rate: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_platform_split?: number | null
          custom_trader_split?: number | null
          display_name: string
          id?: string
          monthly_fee?: number | null
          profit_share_percent?: number | null
          rejection_reason?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          suspended_at?: string | null
          total_earnings?: number
          total_followers?: number
          total_trades_copied?: number
          updated_at?: string
          user_id: string
          win_rate?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_platform_split?: number | null
          custom_trader_split?: number | null
          display_name?: string
          id?: string
          monthly_fee?: number | null
          profit_share_percent?: number | null
          rejection_reason?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          suspended_at?: string | null
          total_earnings?: number
          total_followers?: number
          total_trades_copied?: number
          updated_at?: string
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      daily_volume_snapshots: {
        Row: {
          active_markets_count: number
          created_at: string | null
          daily_trades_count: number
          daily_volume: number
          id: string
          snapshot_date: string
          total_platform_volume: number
          total_trades_count: number
        }
        Insert: {
          active_markets_count?: number
          created_at?: string | null
          daily_trades_count?: number
          daily_volume?: number
          id?: string
          snapshot_date: string
          total_platform_volume?: number
          total_trades_count?: number
        }
        Update: {
          active_markets_count?: number
          created_at?: string | null
          daily_trades_count?: number
          daily_volume?: number
          id?: string
          snapshot_date?: string
          total_platform_volume?: number
          total_trades_count?: number
        }
        Relationships: []
      }
      event_templates: {
        Row: {
          card_style: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          recurrence_type: string | null
          resolution: Json | null
          tags: string[] | null
          title_pattern: string
        }
        Insert: {
          card_style?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          recurrence_type?: string | null
          resolution?: Json | null
          tags?: string[] | null
          title_pattern: string
        }
        Update: {
          card_style?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          recurrence_type?: string | null
          resolution?: Json | null
          tags?: string[] | null
          title_pattern?: string
        }
        Relationships: []
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
            referencedRelation: "wallets_safe"
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
      market_suggestions: {
        Row: {
          admin_notes: string | null
          category: string
          comment_count: number
          created_at: string
          description: string
          downvotes: number
          id: string
          market_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          status: string
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          description: string
          downvotes?: number
          id?: string
          market_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          downvotes?: number
          id?: string
          market_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_suggestions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          card_style: string | null
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
          parent_market_id: string | null
          recurrence_type: string | null
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
          card_style?: string | null
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
          parent_market_id?: string | null
          recurrence_type?: string | null
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
          card_style?: string | null
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
          parent_market_id?: string | null
          recurrence_type?: string | null
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
        Relationships: [
          {
            foreignKeyName: "markets_parent_market_id_fkey"
            columns: ["parent_market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
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
          activated_referrals: number | null
          avatar_url: string | null
          best_markets_won_streak: number | null
          best_streak: number
          best_suggestion_score: number | null
          best_trade_profit: number
          bio: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          copy_trader_id: string | null
          cpf: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          email: string | null
          full_name: string | null
          has_contrarian_trade: boolean | null
          has_early_trade: boolean | null
          has_night_trade: boolean | null
          has_speed_trade: boolean | null
          id: string
          is_blocked: boolean | null
          is_copy_trader: boolean | null
          is_public: boolean
          markets_won_streak: number | null
          phone: string | null
          roi_percent: number
          show_profit: boolean
          show_roi: boolean
          show_trades: boolean
          show_volume: boolean
          suggestions_approved: number | null
          suggestions_created: number | null
          suggestions_implemented: number | null
          total_profit: number
          total_referral_commission: number | null
          total_referrals: number | null
          total_trades: number
          total_volume: number
          updated_at: string
          weekend_trades: number | null
          winning_trades: number
        }
        Insert: {
          activated_referrals?: number | null
          avatar_url?: string | null
          best_markets_won_streak?: number | null
          best_streak?: number
          best_suggestion_score?: number | null
          best_trade_profit?: number
          bio?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          copy_trader_id?: string | null
          cpf?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_contrarian_trade?: boolean | null
          has_early_trade?: boolean | null
          has_night_trade?: boolean | null
          has_speed_trade?: boolean | null
          id: string
          is_blocked?: boolean | null
          is_copy_trader?: boolean | null
          is_public?: boolean
          markets_won_streak?: number | null
          phone?: string | null
          roi_percent?: number
          show_profit?: boolean
          show_roi?: boolean
          show_trades?: boolean
          show_volume?: boolean
          suggestions_approved?: number | null
          suggestions_created?: number | null
          suggestions_implemented?: number | null
          total_profit?: number
          total_referral_commission?: number | null
          total_referrals?: number | null
          total_trades?: number
          total_volume?: number
          updated_at?: string
          weekend_trades?: number | null
          winning_trades?: number
        }
        Update: {
          activated_referrals?: number | null
          avatar_url?: string | null
          best_markets_won_streak?: number | null
          best_streak?: number
          best_suggestion_score?: number | null
          best_trade_profit?: number
          bio?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          copy_trader_id?: string | null
          cpf?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_contrarian_trade?: boolean | null
          has_early_trade?: boolean | null
          has_night_trade?: boolean | null
          has_speed_trade?: boolean | null
          id?: string
          is_blocked?: boolean | null
          is_copy_trader?: boolean | null
          is_public?: boolean
          markets_won_streak?: number | null
          phone?: string | null
          roi_percent?: number
          show_profit?: boolean
          show_roi?: boolean
          show_trades?: boolean
          show_volume?: boolean
          suggestions_approved?: number | null
          suggestions_created?: number | null
          suggestions_implemented?: number | null
          total_profit?: number
          total_referral_commission?: number | null
          total_referrals?: number | null
          total_trades?: number
          total_volume?: number
          updated_at?: string
          weekend_trades?: number | null
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_copy_trader_id_fkey"
            columns: ["copy_trader_id"]
            isOneToOne: false
            referencedRelation: "copy_traders"
            referencedColumns: ["id"]
          },
        ]
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
      suggestion_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "suggestion_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_comment_reports: {
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
            foreignKeyName: "suggestion_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "suggestion_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          likes_count: number
          mentions: string[] | null
          parent_id: string | null
          replies_count: number
          suggestion_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          likes_count?: number
          mentions?: string[] | null
          parent_id?: string | null
          replies_count?: number
          suggestion_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          likes_count?: number
          mentions?: string[] | null
          parent_id?: string | null
          replies_count?: number
          suggestion_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "suggestion_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "market_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
          vote_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
          vote_value: number
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
          vote_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "market_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_staff: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_staff?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_staff?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["support_priority"]
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
          user_id?: string
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
      user_favorites: {
        Row: {
          created_at: string
          id: string
          market_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
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
        Relationships: [
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      payments_safe: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          fee: number | null
          id: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          net_amount: number | null
          status: Database["public"]["Enums"]["payment_status"] | null
          type: Database["public"]["Enums"]["payment_type"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          fee?: number | null
          id?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          net_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          type?: Database["public"]["Enums"]["payment_type"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          fee?: number | null
          id?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          net_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          type?: Database["public"]["Enums"]["payment_type"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
          is_copy_trader: boolean | null
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
          is_copy_trader?: boolean | null
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
          is_copy_trader?: boolean | null
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
      wallets_safe: {
        Row: {
          balance_available: number | null
          created_at: string | null
          currency: string | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance_available?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance_available?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wallets_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_old_reporters: { Args: never; Returns: undefined }
      atomic_deposit_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      atomic_execute_multi_sell: {
        Args: {
          p_contract_id: string
          p_min_value?: number
          p_shares: number
          p_user_id: string
        }
        Returns: Json
      }
      atomic_execute_multi_trade: {
        Args: {
          p_market_id: string
          p_max_cost: number
          p_option_id: string
          p_shares: number
          p_user_id: string
        }
        Returns: Json
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
      atomic_subscribe_copy_trader: {
        Args: {
          p_amount: number
          p_auto_copy?: boolean
          p_copy_percentage?: number
          p_follower_id: string
          p_max_trade_amount?: number
          p_trader_id: string
        }
        Returns: Json
      }
      atomic_withdraw_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      calculate_multi_lmsr_cost: {
        Args: { b: number; shares: number[] }
        Returns: number
      }
      calculate_multi_lmsr_prices: {
        Args: { b: number; shares: number[] }
        Returns: number[]
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
      get_trending_suggestions: {
        Args: {
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          author_avatar: string
          author_name: string
          category: string
          comment_count: number
          created_at: string
          description: string
          downvotes: number
          id: string
          market_id: string
          score: number
          status: string
          title: string
          updated_at: string
          upvotes: number
          user_id: string
          user_vote: number
        }[]
      }
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
      increment_trader_followers: {
        Args: { trader_id: string }
        Returns: undefined
      }
      mask_ip_address: { Args: { ip_address: string }; Returns: string }
      notify_admins: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      process_copy_trade_commissions: {
        Args: { p_market_id: string; p_winning_outcome: string }
        Returns: Json
      }
      process_market_payouts: {
        Args: { p_market_id: string; p_winning_outcome: string }
        Returns: Json
      }
      process_market_settlement_achievements: {
        Args: { p_market_id: string; p_winning_outcome: string }
        Returns: undefined
      }
      recalculate_user_statistics: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      vote_on_suggestion: {
        Args: { p_suggestion_id: string; p_vote_value: number }
        Returns: Json
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
        | "SUGGESTION_COMMENT_MENTION"
        | "SUGGESTION_COMMENT_REPLY"
        | "ADMIN_NEW_TICKET"
        | "ADMIN_NEW_REPORT"
        | "ADMIN_NEW_CONTESTATION"
        | "USER_WARNING"
        | "SUPPORT_REPLY"
        | "SUPPORT_TICKET_RESOLVED"
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
      support_category:
        | "account"
        | "payment"
        | "trading"
        | "technical"
        | "other"
      support_priority: "low" | "medium" | "high" | "urgent"
      support_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
        "SUGGESTION_COMMENT_MENTION",
        "SUGGESTION_COMMENT_REPLY",
        "ADMIN_NEW_TICKET",
        "ADMIN_NEW_REPORT",
        "ADMIN_NEW_CONTESTATION",
        "USER_WARNING",
        "SUPPORT_REPLY",
        "SUPPORT_TICKET_RESOLVED",
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
      support_category: ["account", "payment", "trading", "technical", "other"],
      support_priority: ["low", "medium", "high", "urgent"],
      support_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
