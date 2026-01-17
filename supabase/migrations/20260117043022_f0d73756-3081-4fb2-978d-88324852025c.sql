-- Corrigir ícones duplicados nas conquistas de sequência
UPDATE public.achievements 
SET icon = '🔥'
WHERE code IN ('streak_5', 'streak_10');

-- Também corrigir win_streak se existirem
UPDATE public.achievements 
SET icon = '⚡'
WHERE code = 'win_streak_5';

UPDATE public.achievements 
SET icon = '⭐'
WHERE code = 'win_streak_10';