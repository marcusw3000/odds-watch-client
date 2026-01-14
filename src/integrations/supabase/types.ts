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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
          title?: string
          total_volume?: number
          updated_at?: string
          yes_shares?: number
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
      user_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_available?: number
          balance_locked?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      market_status: "OPEN" | "HALTED" | "PENDING" | "CONTESTED" | "SETTLED"
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
