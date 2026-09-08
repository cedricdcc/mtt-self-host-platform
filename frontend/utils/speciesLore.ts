export interface SpeciesLore {
  nickname: string;
  personality: string;
  favoriteFood: string;
  quote: string;
  realFact: string;
  image: string;
  avatarBg: string;
  emoji: string;
}

export const SPECIES_LORE: Record<string, SpeciesLore> = {
  azure_damselfish: {
    nickname: 'The Turbo Nibbler',
    personality: 'Territorial menace in a neon blue outfit',
    favoriteFood: 'Algae wafers & unfiltered rage',
    quote: 'This 2-centimeter rock is MY empire. Begone.',
    realFact: 'Damselfish actively farm and weed their own algae gardens and will boldly bite scuba divers to defend them.',
    image: '/species/azure_damselfish.png',
    avatarBg: 'from-cyan-400 to-blue-600',
    emoji: '🐟'
  },
  sunburst_tang: {
    nickname: 'Solar Powered Banana',
    personality: 'Vibe curator, refuses to dim its shine',
    favoriteFood: 'Seaweed crisps & tropical rays',
    quote: 'Why swim quietly when you can illuminate the entire reef?',
    realFact: 'Yellow tangs graze continually on turf algae, playing an indispensable role in keeping coral reefs healthy and clear.',
    image: '/species/sunburst_tang.png',
    avatarBg: 'from-amber-300 to-yellow-500',
    emoji: '🐠'
  },
  emerald_parrotfish: {
    nickname: 'The Beach Architect',
    personality: 'Loud chewer, master of coral crunch',
    favoriteFood: 'Limestone rocks & calcium snacks',
    quote: 'I do not just visit white sand beaches... I manufacture them.',
    realFact: 'Parrotfish use their fused beak-like teeth to scrape algae off coral, excreting up to 450 kg of pure white coral sand per fish annually.',
    image: '/species/emerald_parrotfish.png',
    avatarBg: 'from-emerald-400 to-teal-600',
    emoji: '🦜'
  },
  clown_anemone: {
    nickname: 'The Wiggle Connoisseur',
    personality: 'Main character energy, sleeps inside venomous tentacles',
    favoriteFood: 'Plankton & animated movie royalties',
    quote: 'The stinging tentacles feel like a warm electric blanket.',
    realFact: 'Clownfish produce a thick protective mucus layer that prevents sea anemone nematocysts from firing when they brush against them.',
    image: '/species/clown_anemone.png',
    avatarBg: 'from-orange-400 to-amber-500',
    emoji: '🐡'
  },
  golden_seahorse: {
    nickname: 'The Micro Sovereign',
    personality: 'Slow-paced philosopher, tail-anchor champion',
    favoriteFood: 'Tiny copepods sipped through a straw',
    quote: 'Speed is an illusion. Anchoring tightly to seagrass is eternal.',
    realFact: 'Seahorses are among the only animal species on Earth where the male undergoes pregnancy and gives birth to live fry.',
    image: '/species/golden_seahorse.png',
    avatarBg: 'from-amber-400 to-orange-500',
    emoji: '🐴'
  },
  sapphire_manta: {
    nickname: 'The Velvety Flat-Flap',
    personality: 'Graceful sea kite, entirely allergic to drama',
    favoriteFood: 'Microscopic plankton buffet by the gallon',
    quote: 'Just coasting on the warm oceanic currents of chill.',
    realFact: 'Manta rays possess the largest brain-to-body mass ratio of all fish and exhibit self-awareness in mirror tests.',
    image: '/species/sapphire_manta.png',
    avatarBg: 'from-blue-600 to-indigo-900',
    emoji: '🪁'
  },
  solar_lionfish: {
    nickname: 'The Spiky Diva',
    personality: 'Glamorous runway model, handles with caution',
    favoriteFood: 'Small reef snacks served with grandeur',
    quote: 'Every angle is my best angle, but do not touch the spikes.',
    realFact: 'Lionfish feature eighteen ornate venomous needle-sharp dorsal spines used exclusively for defensive determent.',
    image: '/species/solar_lionfish.png',
    avatarBg: 'from-rose-500 to-red-600',
    emoji: '🦁'
  },
  spotted_pufferfish: {
    nickname: 'Certified Drama Balloon',
    personality: 'Easily startled, 90% seawater and panic',
    favoriteFood: 'Crunchy snails & personal space',
    quote: 'If not friend, why round?',
    realFact: 'Pufferfish rapidly ingest gallons of water to swell into an unswallowable prickly sphere when threatened by predators.',
    image: '/puffer.png',
    avatarBg: 'from-amber-400 to-yellow-600',
    emoji: '🐡'
  },
  silver_hatchet: {
    nickname: 'The Flying Mirror Blade',
    personality: 'Paper thin, permanently gazing toward heaven',
    favoriteFood: 'Twilight gnats & floating surface morsels',
    quote: 'I am two millimeters wide and I have an axe to grind.',
    realFact: 'Hatchetfish have ultra-thin silver bodies with ventral photophores that match downwelling surface light to achieve counter-illumination camouflage.',
    image: '/species/silver_hatchet.png',
    avatarBg: 'from-slate-300 to-slate-500',
    emoji: '🪓'
  },
  glass_lantern: {
    nickname: 'The Midnight High-Beams',
    personality: 'Night-owl raver, brings its own headlights',
    favoriteFood: 'Deep twilight copepod snacks',
    quote: 'Turn down for what? (I literally cannot switch my photophores off).',
    realFact: 'Lanternfish account for as much as 65% of all deep-sea fish biomass on Earth and migrate vertically hundreds of meters every night.',
    image: '/species/glass_lantern.png',
    avatarBg: 'from-cyan-300 to-sky-600',
    emoji: '🏮'
  },
  ribbon_oarfish: {
    nickname: 'The Mythical Ocean Noodle',
    personality: 'Way too long for its own good, swims vertically',
    favoriteFood: 'Krill swarms & seismic rumors',
    quote: 'I am not a sea serpent, I just have very eccentric posture.',
    realFact: 'The giant oarfish is the longest bony fish alive, reaching up to 11 meters, and traditionally inspired ancient sea serpent legends.',
    image: '/species/ribbon_oarfish.png',
    avatarBg: 'from-sky-200 to-blue-400',
    emoji: '🎗️'
  },
  prismatic_squid: {
    nickname: 'The Crystalline Illusionist',
    personality: 'Moody master of disguise with mood-ring optics',
    favoriteFood: 'Shimmering abyssal shrimp',
    quote: 'Now you see me... now I am clear as drinking water.',
    realFact: 'Glass squids spend their youth near the surface where their transparent bodies leave only their digestive gland and eyes visible.',
    image: '/species/prismatic_squid.png',
    avatarBg: 'from-purple-400 to-pink-500',
    emoji: '🦑'
  },
  vampire_octo: {
    nickname: 'The Gothic Velvet Umbrella',
    personality: 'Dark-cloaked introvert, prefers silence and literature',
    favoriteFood: 'Marine snow & vintage deep-sea detritus',
    quote: 'I do not drink blood; I gently consume ocean dust in peace.',
    realFact: 'Vampire squids are neither true squids nor octopuses; they deploy bioluminescent mucus clouds instead of ink when alarmed.',
    image: '/species/vampire_octo.png',
    avatarBg: 'from-red-900 to-stone-950',
    emoji: '🧛'
  },
  coelacanth_shadow: {
    nickname: 'The 400-Million-Year Slacker',
    personality: 'Resisted extinction by simply doing nothing for eons',
    favoriteFood: 'Ancient nocturnal reef fish',
    quote: 'Dinosaurs came and went. I remained in my undersea cave.',
    realFact: 'Coelacanths possess fleshy lobed fins supported by bones, resembling the ancestral limbs of early terrestrial tetrapods.',
    image: '/species/coelacanth_shadow.png',
    avatarBg: 'from-indigo-950 to-slate-900',
    emoji: '🦖'
  },
  ghost_grenadier: {
    nickname: 'The Rattail Hermit',
    personality: 'Grumpy bottom-dweller, firmly anti-daylight',
    favoriteFood: 'Whatever drifts into the abyssal trough',
    quote: 'Get off my continental slope.',
    realFact: 'Grenadiers possess enormous heads and tapering rattails, cruising slowly above the ocean floor using sensitive chin barbels to detect buried worms.',
    image: '/species/ghost_grenadier.png',
    avatarBg: 'from-stone-300 to-slate-600',
    emoji: '👻'
  },
  bioluminescent_angler: {
    nickname: 'Midnight Fishing Champion',
    personality: 'Patience of a monk, dental plan of a horror movie',
    favoriteFood: 'Any curious fish that investigates shiny lures',
    quote: 'Come closer... it is just a friendly deep-sea reading lamp.',
    realFact: 'Female anglerfish carry an illuminated dorsal appendage filled with bioluminescent photobacteria that lures prey straight into their cavernous jaws.',
    image: '/species/bioluminescent_angler.png',
    avatarBg: 'from-teal-900 to-slate-950',
    emoji: '🎣'
  },
  gulper_void: {
    nickname: 'The Unhinged Pelican',
    personality: 'Mouth constitutes 95% of total body volume',
    favoriteFood: 'Anything larger than its actual body',
    quote: 'My eyes are tiny because my stomach has cosmic ambitions.',
    realFact: 'The pelican eel has loosely hinged jaws and an elastic pouch stomach allowing it to engulf prey significantly larger than itself.',
    image: '/species/gulper_void.png',
    avatarBg: 'from-violet-950 to-black',
    emoji: '🐍'
  },
  dumbo_specter: {
    nickname: 'Deep-Sea Ear-Wiggler',
    personality: 'Gentle abyssal puppy, radiates wholesome joy',
    favoriteFood: 'Tiny benthic crustaceans & cozy vibes',
    quote: 'Flap, flap, flap... life is peaceful at 4,000 meters.',
    realFact: 'Dumbo octopuses live deeper than almost any other cephalopod, hovering gently above the hadal ocean floor by flapping their ear-like fins.',
    image: '/species/dumbo_specter.png',
    avatarBg: 'from-pink-300 to-purple-400',
    emoji: '🐙'
  },
  crystal_siphonophore: {
    nickname: 'The Infinite String Cheese',
    personality: 'A million clones pretending to be one individual',
    favoriteFood: 'Drifting abyssal micro-plankton',
    quote: 'We are one organism, but also we are 10,000 roommates.',
    realFact: 'Siphonophores are colonial organisms composed of thousands of genetically identical yet specialized zooids performing digestion, swimming, and reproduction.',
    image: '/species/crystal_siphonophore.png',
    avatarBg: 'from-cyan-400 to-emerald-400',
    emoji: '🪢'
  },
  abyssal_leviathan: {
    nickname: 'The Hadal Trench Sovereign',
    personality: 'Older than the continental drift, naps for decades',
    favoriteFood: 'Enormous krill clouds & deep silence',
    quote: 'Down here in the pitch black, only legends survive.',
    realFact: 'Deep hadal trenches reach depths over 10,000 meters with hydrostatic pressures exceeding 1,000 atmospheres, home to unique giant amphipods.',
    image: '/species/abyssal_leviathan.png',
    avatarBg: 'from-slate-900 to-black',
    emoji: '🐋'
  },
  cosmic_jelly: {
    nickname: 'The Galactic Squish',
    personality: '95% seawater, 5% starlight and audacity',
    favoriteFood: 'Currents of cosmic marine dust',
    quote: 'I pulse rhythmically, therefore the universe continues.',
    realFact: 'Jellyfish have drifted through the world oceans for over 500 million years, surviving five major mass extinction events on Earth.',
    image: '/species/cosmic_jelly.png',
    avatarBg: 'from-fuchsia-500 to-rose-500',
    emoji: '🪼'
  }
};
