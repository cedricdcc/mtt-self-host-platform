import React, { useState } from 'react';
import { CodexResponse, GachaSpecies } from '../../types';
import { SPECIES_LORE, SpeciesLore } from '../../utils/speciesLore';
import { BookOpen, Award, Lock, Sparkles, Filter, X, HelpCircle, Heart, Quote, Compass, Rotate3d } from 'lucide-react';
import Species3DPreview from './Species3DPreview';

const STATIC_PNG_SPECIES = new Set([
  'azure_damselfish',
  'bioluminescent_angler',
  'cosmic_jelly',
  'dumbo_specter',
  'emerald_parrotfish',
  'golden_seahorse',
  'sapphire_manta',
  'solar_lionfish',
  'spotted_pufferfish',
  'sunburst_tang'
]);

interface MarineCodexProps {
  codexData: CodexResponse;
}

const RARITY_BADGES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  common: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600', glow: 'shadow-slate-500/10' },
  uncommon: { bg: 'bg-emerald-950', text: 'text-emerald-300', border: 'border-emerald-600', glow: 'shadow-emerald-500/20' },
  rare: { bg: 'bg-blue-950', text: 'text-blue-300', border: 'border-blue-600', glow: 'shadow-blue-500/25' },
  epic: { bg: 'bg-purple-950', text: 'text-purple-300', border: 'border-purple-600', glow: 'shadow-purple-500/30' },
  legendary: { bg: 'bg-amber-950', text: 'text-amber-300', border: 'border-amber-500', glow: 'shadow-amber-500/35' }
};

export const MarineCodex: React.FC<MarineCodexProps> = ({ codexData }) => {
  const [selectedZone, setSelectedZone] = useState<'all' | 'sunlit' | 'twilight' | 'abyssal'>('all');
  const [inspectingSpecies, setInspectingSpecies] = useState<GachaSpecies | null>(null);
  const [inspectingShiny, setInspectingShiny] = useState<boolean>(false);
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});

  const filteredSpecies = codexData.species.filter(s =>
    selectedZone === 'all' ? true : s.depth_zone === selectedZone
  );

  const inspectingLore: SpeciesLore | undefined = inspectingSpecies ? SPECIES_LORE[inspectingSpecies.id] : undefined;

  return (
    <div className="w-full min-h-[600px] md:min-h-[750px] rounded-2xl border border-sky-900/40 bg-slate-950 p-4 md:p-8 flex flex-col justify-between">
      {/* Header & Progress Stats */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 flex-shrink-0">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                <span>The Marine Codex</span>
                <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                  {codexData.total_discovered} / {codexData.total_species} Species
                </span>
                {Boolean(codexData.total_shiny_discovered) && (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>{codexData.total_shiny_discovered} Shinies</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Funny specimen dossiers & deep-ocean field guide</p>
            </div>
          </div>

          {/* Collection Progress Bar */}
          <div className="w-full md:w-64 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-inner">
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Collection Progress</span>
              <span className="text-cyan-400 font-bold">{codexData.completion_percentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${codexData.completion_percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Zone Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Depth Zone:</span>
          </div>
          {(['all', 'sunlit', 'twilight', 'abyssal'] as const).map(zone => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                selectedZone === zone
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {zone === 'all' ? 'All Depths' : zone}
            </button>
          ))}
        </div>

        {/* Species Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 max-h-[580px] overflow-y-auto pr-1">
          {filteredSpecies.map(species => {
            const isDiscovered = species.is_discovered;
            const badge = RARITY_BADGES[species.rarity] || RARITY_BADGES.common;
            const lore = SPECIES_LORE[species.id];
            const hasImgError = imgErrorMap[species.id];

            return (
              <div
                key={species.id}
                onClick={() => {
                  if (isDiscovered) {
                    setInspectingSpecies(species);
                    setInspectingShiny(Boolean(species.discovered_shiny));
                  }
                }}
                className={`relative p-3 rounded-2xl border transition-all duration-200 flex flex-col items-center text-center group ${
                  isDiscovered
                    ? `bg-slate-900/90 border-slate-700/80 hover:border-cyan-400 hover:shadow-xl ${badge.glow} cursor-pointer hover:-translate-y-1`
                    : 'bg-slate-950 border-slate-900/80 opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Shiny Star Badge */}
                {species.discovered_shiny && (
                  <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-400/50 rounded-full p-1 text-amber-300 shadow-sm z-10 animate-pulse" title="✨ Shiny Variant Discovered!">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                  </div>
                )}

                {/* Catch multiplier pill */}
                {isDiscovered && (
                  <div className="absolute top-2 left-2 bg-slate-950/80 border border-slate-700 text-cyan-300 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">
                    ×{species.caught_count}
                  </div>
                )}

                {/* Specimen Portrait / Silhouette */}
                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center mb-2.5 relative overflow-hidden transition-transform duration-200 group-hover:scale-105 ${
                    isDiscovered ? 'border border-white/10 shadow-inner' : 'bg-slate-900/90 border border-slate-800'
                  }`}
                  style={{
                    background: isDiscovered
                      ? `linear-gradient(135deg, ${species.visual_traits?.primary_color || '#00d2ff'}, ${species.visual_traits?.secondary_color || '#3a7bd5'})`
                      : '#0b0f19'
                  }}
                >
                  {isDiscovered ? (
                    lore && lore.image && STATIC_PNG_SPECIES.has(species.id) && !hasImgError ? (
                      <img
                        src={lore.image}
                        alt={species.name}
                        className="w-full h-full object-cover object-center"
                        onError={() => setImgErrorMap(prev => ({ ...prev, [species.id]: true }))}
                      />
                    ) : (
                      <Species3DPreview
                        species={species}
                        isShiny={Boolean(species.discovered_shiny)}
                        interactive={false}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 gap-1 select-none">
                      <Lock className="w-5 h-5" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Locked</span>
                    </div>
                  )}
                </div>

                {/* Species Name & Funny Nickname */}
                <h4 className="font-bold text-xs text-white line-clamp-1 mb-0.5">
                  {isDiscovered ? species.name : 'Undiscovered Specimen'}
                </h4>

                {isDiscovered && lore?.nickname ? (
                  <p className="text-[10px] text-amber-300/90 italic line-clamp-1 mb-2 font-medium">
                    "{lore.nickname}"
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 font-mono line-clamp-1 mb-2 capitalize">
                    {species.depth_zone} Depth
                  </p>
                )}

                {/* Bottom Badges */}
                <div className="flex items-center gap-1.5 mt-auto pt-1 w-full justify-center">
                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {species.rarity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspect Modal ("Field Guide Dossier") */}
      {inspectingSpecies && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setInspectingSpecies(null)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setInspectingSpecies(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Specimen Header & Interactive 3D Turntable Showcase */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-5">
              {/* Interactive 3D Specimen Turntable Box */}
              <div
                className={`w-36 h-36 sm:w-40 sm:h-40 rounded-3xl flex items-center justify-center border-2 relative overflow-hidden shadow-2xl flex-shrink-0 ${
                  inspectingShiny
                    ? 'border-amber-400 shadow-amber-500/30'
                    : 'border-cyan-400/40 shadow-cyan-500/20'
                }`}
                style={{
                  background: inspectingShiny
                    ? `radial-gradient(circle at 50% 40%, #3b2f0b, #090d16)`
                    : `radial-gradient(circle at 50% 40%, ${inspectingSpecies.visual_traits?.primary_color || '#00d2ff'}33, #090d16)`
                }}
              >
                <Species3DPreview
                  species={inspectingSpecies}
                  isShiny={inspectingShiny}
                  interactive={true}
                />
                {inspectingShiny && (
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-transparent to-transparent pointer-events-none" />
                )}
                <div className="absolute bottom-1.5 inset-x-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 flex items-center justify-center gap-1 pointer-events-none">
                  <Rotate3d className="w-2.5 h-2.5" />
                  <span>Drag to rotate 3D model</span>
                </div>
              </div>

              {/* Title, Nickname & Badges */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {inspectingSpecies.name}
                  </h3>
                  {inspectingShiny && (
                    <span className="text-xs text-amber-300 font-mono font-black px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>SHINY</span>
                    </span>
                  )}
                </div>

                {inspectingLore?.nickname && (
                  <p className="text-sm font-semibold text-amber-300 italic mt-0.5">
                    "{inspectingLore.nickname}"
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${RARITY_BADGES[inspectingSpecies.rarity].bg} ${RARITY_BADGES[inspectingSpecies.rarity].text} ${RARITY_BADGES[inspectingSpecies.rarity].border}`}>
                    {inspectingSpecies.rarity}
                  </span>
                  <span className="text-xs text-sky-400 capitalize px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-800">
                    {inspectingSpecies.depth_zone} Depth
                  </span>
                </div>
              </div>
            </div>

            {/* Shiny Toggle Button if Discovered */}
            {inspectingSpecies.discovered_shiny && (
              <div className="flex items-center gap-2 mb-4 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setInspectingShiny(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    !inspectingShiny ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Standard Form
                </button>
                <button
                  onClick={() => setInspectingShiny(true)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1 ${
                    inspectingShiny
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-md'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Shiny Form</span>
                </button>
              </div>
            )}

            {/* Funny Speech Bubble / Quote */}
            {inspectingLore?.quote && (
              <div className="relative mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-400 text-amber-200 text-xs italic flex items-start gap-2.5">
                <Quote className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>"{inspectingLore.quote}"</p>
              </div>
            )}

            {/* Quirky Field Notes & Facts */}
            <div className="space-y-3 mb-5">
              {inspectingLore?.personality && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-xs">
                  <span className="font-bold text-cyan-400 uppercase tracking-wider block text-[10px] mb-0.5">
                    Personality
                  </span>
                  <p className="text-slate-200 leading-relaxed">{inspectingLore.personality}</p>
                </div>
              )}

              {inspectingLore?.favoriteFood && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-xs">
                  <span className="font-bold text-amber-400 uppercase tracking-wider block text-[10px] mb-0.5">
                    Favorite Snack
                  </span>
                  <p className="text-slate-200 leading-relaxed">{inspectingLore.favoriteFood}</p>
                </div>
              )}

              {/* Real Biological Fact */}
              {inspectingLore?.realFact && (
                <div className="bg-slate-950/80 border border-sky-800/40 rounded-2xl p-3 text-xs">
                  <span className="font-bold text-sky-400 uppercase tracking-wider block text-[10px] mb-0.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-sky-400" />
                    <span>Real Marine Biology Fact</span>
                  </span>
                  <p className="text-slate-300 leading-relaxed">{inspectingLore.realFact}</p>
                </div>
              )}
            </div>

            {/* Catch Statistics */}
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase text-slate-500">Specimens Caught</span>
                <strong className="text-white text-sm font-mono mt-0.5">×{inspectingSpecies.caught_count}</strong>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase text-slate-500">First Discovered</span>
                <strong className="text-white text-xs font-mono mt-1">
                  {inspectingSpecies.first_caught_at
                    ? new Date(inspectingSpecies.first_caught_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarineCodex;
