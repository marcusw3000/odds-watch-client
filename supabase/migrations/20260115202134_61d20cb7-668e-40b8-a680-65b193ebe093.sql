-- =====================================================
-- FASE 2: Consolidar Perfis - MIGRAÇÃO COMPLETA
-- =====================================================

-- 1. Adicionar campos de leaderboard à tabela profiles (se não existirem)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_profit BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_roi BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_volume BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_trades BOOLEAN NOT NULL DEFAULT true;

-- 2. Adicionar campos de estatísticas à tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_profit NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS roi_percent NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_volume NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_trades INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS winning_trades INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_trade_profit NUMERIC NOT NULL DEFAULT 0;