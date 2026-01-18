-- Remove user_achievements entries for community achievements
DELETE FROM user_achievements 
WHERE achievement_id IN (
  SELECT id FROM achievements WHERE category = 'community'
);

-- Remove community achievements
DELETE FROM achievements WHERE category = 'community';