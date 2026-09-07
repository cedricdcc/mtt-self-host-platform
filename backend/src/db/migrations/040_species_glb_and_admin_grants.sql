-- Migration 040: Add model_url column to gacha_species and seed spotted_pufferfish with /models/puffer.glb

ALTER TABLE gacha_species ADD COLUMN model_url TEXT DEFAULT NULL;

INSERT OR IGNORE INTO gacha_species (id, name, depth_zone, rarity, drop_weight, description, visual_traits, model_url)
VALUES (
  'spotted_pufferfish',
  'Spotted Pufferfish',
  'sunlit',
  'rare',
  8,
  'An endearing globose swimmer with fine spots and expressive eyes that inflates when startled.',
  '{"primary_color":"#f59e0b","secondary_color":"#fef3c7","scale":1.1,"glow":false,"body_type":"oval"}',
  '/models/puffer.glb'
);
