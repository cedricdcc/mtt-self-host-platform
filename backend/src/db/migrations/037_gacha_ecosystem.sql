-- 037_gacha_ecosystem.sql
-- Creates tables for the Oceanarium Gacha Ecosystem and seeds 20 stylized marine species

CREATE TABLE IF NOT EXISTS gacha_species (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    depth_zone TEXT NOT NULL CHECK(depth_zone IN ('sunlit', 'twilight', 'abyssal')),
    rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    drop_weight INTEGER NOT NULL,
    description TEXT NOT NULL,
    visual_traits TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_ecosystem (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tickets INTEGER NOT NULL DEFAULT 0,
    food_flakes INTEGER NOT NULL DEFAULT 5,
    super_pellets INTEGER NOT NULL DEFAULT 1,
    water_quality INTEGER NOT NULL DEFAULT 100,
    last_fed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_decay_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pity_counter_epic INTEGER NOT NULL DEFAULT 0,
    pity_counter_legendary INTEGER NOT NULL DEFAULT 0,
    total_pulls INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_fishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id) ON DELETE CASCADE,
    nickname TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'dormant')),
    caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_user_fishes_user ON user_fishes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fishes_species ON user_fishes(species_id);

CREATE TABLE IF NOT EXISTS gacha_pull_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES gacha_species(id),
    pull_type TEXT NOT NULL DEFAULT 'single' CHECK(pull_type IN ('single', 'multi')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gacha_pull_logs_user ON gacha_pull_logs(user_id);

-- Seed 20 Stylized Marine Species
INSERT OR IGNORE INTO gacha_species (id, name, depth_zone, rarity, drop_weight, description, visual_traits) VALUES
('azure_damselfish', 'Azure Damselfish', 'sunlit', 'common', 25, 'A spirited neon-blue reef dweller that zips through shallow corals.', '{"primary_color":"#00d2ff","secondary_color":"#3a7bd5","scale":0.9,"glow":false,"body_type":"oval"}'),
('sunburst_tang', 'Sunburst Tang', 'sunlit', 'common', 25, 'Radiates brilliant gold and lemon hues across sunlit lagoons.', '{"primary_color":"#ffe259","secondary_color":"#ffa751","scale":1.0,"glow":false,"body_type":"disc"}'),
('emerald_parrotfish', 'Emerald Parrotfish', 'sunlit', 'common', 20, 'Gleams with jade scales, nibbling peacefully on algae-covered rocks.', '{"primary_color":"#11998e","secondary_color":"#38ef7d","scale":1.1,"glow":false,"body_type":"torpedo"}'),
('clown_anemone', 'Clown Anemonefish', 'sunlit', 'uncommon', 15, 'Instantly recognizable orange ribbons, playful and beloved.', '{"primary_color":"#ff7e5f","secondary_color":"#feb47b","scale":0.95,"glow":false,"body_type":"oval"}'),
('golden_seahorse', 'Golden Pygmy Seahorse', 'sunlit', 'uncommon', 12, 'Anchors its tail gently to coral branches, floating serenely.', '{"primary_color":"#f7971e","secondary_color":"#ffd200","scale":0.85,"glow":false,"body_type":"vertical"}'),
('sapphire_manta', 'Sapphire Reef Manta', 'sunlit', 'rare', 5, 'Glides majestically through surface currents with velvety sapphire wings.', '{"primary_color":"#1a2a6c","secondary_color":"#00c6ff","scale":1.6,"glow":false,"body_type":"ray"}'),
('solar_lionfish', 'Solar Lionfish', 'sunlit', 'epic', 2, 'Adorned with ornate feather-like fins that shimmer like molten sunlight.', '{"primary_color":"#ff416c","secondary_color":"#ff4b2b","scale":1.3,"glow":true,"body_type":"spiky"}'),

('silver_hatchet', 'Silver Hatchetfish', 'twilight', 'common', 20, 'Mirror-plated nocturnal creature reflecting faint twilight glimmers.', '{"primary_color":"#bdc3c7","secondary_color":"#2c3e50","scale":0.9,"glow":false,"body_type":"hatchet"}'),
('glass_lantern', 'Glass Lanternfish', 'twilight', 'uncommon', 15, 'Translucent scales reveal an array of subtle bioluminescent photophores.', '{"primary_color":"#89f7fe","secondary_color":"#66a6ff","scale":0.95,"glow":true,"body_type":"torpedo"}'),
('ribbon_oarfish', 'Ribbon Oarfish', 'twilight', 'rare', 6, 'An undulating silver serpent with a striking crimson crest.', '{"primary_color":"#e0eafc","secondary_color":"#cfdef3","scale":2.0,"glow":false,"body_type":"ribbon"}'),
('prismatic_squid', 'Prismatic Glass Squid', 'twilight', 'rare', 5, 'Crystalline tentacles refract deep-ocean ambient wavelengths.', '{"primary_color":"#c471ed","secondary_color":"#12c2e9","scale":1.2,"glow":true,"body_type":"squid"}'),
('vampire_octo', 'Crimson Vampire Octopus', 'twilight', 'epic', 2, 'Cloaked in velvety ruby webbing with bioluminescent finger tips.', '{"primary_color":"#870000","secondary_color":"#190a05","scale":1.3,"glow":true,"body_type":"octo"}'),
('coelacanth_shadow', 'Ancient Dusk Coelacanth', 'twilight', 'legendary', 1, 'A living fossil from primordial seas with armored lobed fins.', '{"primary_color":"#200122","secondary_color":"#6f0000","scale":1.8,"glow":true,"body_type":"ancient"}'),

('ghost_grenadier', 'Ghost Grenadier', 'abyssal', 'uncommon', 12, 'Pale deep-sea prowler navigating pitch-black volcanic troughs.', '{"primary_color":"#e6dada","secondary_color":"#274046","scale":1.1,"glow":false,"body_type":"rattail"}'),
('bioluminescent_angler', 'Bioluminescent Angler', 'abyssal', 'rare', 6, 'Lures curious prey in midnight waters with a glowing escas lure.', '{"primary_color":"#0f2027","secondary_color":"#00f2fe","scale":1.2,"glow":true,"body_type":"angler"}'),
('gulper_void', 'Void Gulper Eel', 'abyssal', 'rare', 5, 'Enormous jaws capable of swallowing prey much larger than itself.', '{"primary_color":"#141e30","secondary_color":"#243b55","scale":1.7,"glow":false,"body_type":"eel"}'),
('dumbo_specter', 'Dumbo Specter Octopus', 'abyssal', 'epic', 2, 'Flaps delicate ear-like fins through the deepest oceanic abysses.', '{"primary_color":"#a18cd1","secondary_color":"#fbc2eb","scale":1.0,"glow":true,"body_type":"dumbo"}'),
('crystal_siphonophore', 'Crystal Siphonophore', 'abyssal', 'epic', 2, 'A shimmering colonial organism trailing bioluminescent bells.', '{"primary_color":"#00c9ff","secondary_color":"#92fe9d","scale":2.2,"glow":true,"body_type":"chain"}'),
('abyssal_leviathan', 'Abyssal Trench Leviathan', 'abyssal', 'legendary', 1, 'A mythical colossal titan roaming the deepest hadal trenches.', '{"primary_color":"#0b0c10","secondary_color":"#66fcf1","scale":2.5,"glow":true,"body_type":"leviathan"}'),
('cosmic_jelly', 'Cosmic Aurelia Jelly', 'abyssal', 'legendary', 1, 'A translucent bell pulsating with nebular ultraviolet starbursts.', '{"primary_color":"#f857a6","secondary_color":"#ff5858","scale":1.6,"glow":true,"body_type":"jelly"}');
