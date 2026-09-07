import React, { useState } from 'react';
import { CodexResponse, GachaSpecies } from '../../types';
import { BookOpen, Award, Lock, Sparkles, Filter, X } from 'lucide-react';

interface MarineCodexProps {
  codexData: CodexResponse;
}

const RARITY_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  common: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' },
  uncommon: { bg: 'bg-emerald-950', text: 'text-emerald-300', border: 'border-emerald-600' },
  rare: { bg: 'bg-blue-950', text: 'text-blue-300', border: 'border-blue-600' },
  epic: { bg: 'bg-purple-950', text: 'text-purple-300', border: 'border-purple-600' },
  legendary: { bg: 'bg-amber-950', text: 'text-amber-300', border: 'border-amber-500' }
};

export const MarineCodex: React.FC<MarineCodexProps> = ({ codexData }) => {
  const [selectedZone, setSelectedZone] = useState<'all' | 'sunlit' | 'twilight' | 'abyssal'>('all');
  const [inspectingSpecies, setInspectingSpecies] = useState<GachaSpecies | null>(null);
  const [inspectingShiny, setInspectingShiny] = useState<boolean>(false);

  const filteredSpecies = codexData.species.filter(s =>
    selectedZone === 'all' ? true : s.depth_zone === selectedZone
  );

  return (
    <div className="w-full min-h-[650px] md:min-h-[750px] rounded-2xl border border-sky-900/40 bg-slate-950 p-6 md:p-8 flex flex-col justify-between">
      {/* Header & Progress Stats */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center">
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
              <p className="text-xs text-slate-400">Specimen taxonomy & deep-ocean collection field guide</p>
            </div>
          </div>

          {/* Collection Progress Bar */}
          <div className="w-full md:w-64 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Collection Progress</span>
              <span className="text-cyan-400 font-bold">{codexData.completion_percentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${codexData.completion_percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Zone Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Zone:</span>
          </div>
          {(['all', 'sunlit', 'twilight', 'abyssal'] as const).map(zone => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                selectedZone === zone
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {zone === 'all' ? 'All Depths' : zone}
            </button>
          ))}
        </div>

        {/* Species Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 max-h-[500px] overflow-y-auto pr-1">
          {filteredSpecies.map(species => {
            const isDiscovered = species.is_discovered;
            const badge = RARITY_BADGES[species.rarity] || RARITY_BADGES.common;

            return (
              <div
                key={species.id}
                onClick={() => {
                  if (isDiscovered) {
                    setInspectingSpecies(species);
                    setInspectingShiny(Boolean(species.discovered_shiny));
                  }
                }}
                className={`relative p-3.5 rounded-xl border transition-all duration-200 flex flex-col items-center text-center ${
                  isDiscovered
                    ? 'bg-slate-900/80 border-slate-700/80 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer'
                    : 'bg-slate-950 border-slate-900 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Shiny Star Badge */}
                {species.discovered_shiny && (
                  <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-400/40 rounded-full p-1 text-amber-300 shadow-sm" title="✨ Shiny Variant Discovered!">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                  </div>
                )}
                {/* Species Icon / Silhouette */}
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mb-2.5 ${
                    isDiscovered ? 'border border-white/20 shadow-inner' : 'bg-slate-900 border border-slate-800'
                  }`}
                  style={{
                    background: isDiscovered
                      ? `linear-gradient(135deg, ${species.visual_traits?.primary_color || '#00d2ff'}, ${species.visual_traits?.secondary_color || '#3a7bd5'})`
                      : '#0f172a'
                  }}
                >
                  {isDiscovered ? (
                    <span className="text-2xl select-none">🐟</span>
                  ) : (
                    <Lock className="w-5 h-5 text-slate-600" />
                  )}
                </div>

                <h4 className="font-semibold text-xs text-white line-clamp-1 mb-1">
                  {isDiscovered ? species.name : 'Unknown Specimen'}
                </h4>

                <div className="flex items-center gap-1 mt-auto">
                  <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {species.rarity}
                  </span>
                  {isDiscovered && (
                    <span className="text-[10px] text-cyan-400 font-mono">
                      ×{species.caught_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectingSpecies && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectingSpecies(null)}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setInspectingSpecies(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg relative overflow-hidden"
                style={{
                  background: inspectingShiny
                    ? `linear-gradient(135deg, #ffd700, #ff80bf)`
                    : `linear-gradient(135deg, ${inspectingSpecies.visual_traits?.primary_color || '#00d2ff'}, ${inspectingSpecies.visual_traits?.secondary_color || '#3a7bd5'})`
                }}
              >
                <span className="text-3xl select-none">{inspectingShiny ? '✨' : '🐟'}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{inspectingSpecies.name}</span>
                    {inspectingShiny && (
                      <span className="text-xs text-amber-300 font-mono font-black px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50">
                        SHINY
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${RARITY_BADGES[inspectingSpecies.rarity].bg} ${RARITY_BADGES[inspectingSpecies.rarity].text} ${RARITY_BADGES[inspectingSpecies.rarity].border}`}>
                    {inspectingSpecies.rarity}
                  </span>
                  <span className="text-xs text-sky-400 capitalize">{inspectingSpecies.depth_zone} Depth</span>
                </div>
              </div>
            </div>

            {/* Shiny Variant Toggle */}
            {inspectingSpecies.discovered_shiny && (
              <div className="flex items-center gap-2 mb-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => setInspectingShiny(false)}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    !inspectingShiny ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Standard Form
                </button>
                <button
                  onClick={() => setInspectingShiny(true)}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                    inspectingShiny ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black' : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Shiny Form</span>
                </button>
              </div>
            )}

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 mb-4 text-xs text-slate-300 leading-relaxed">
              {inspectingSpecies.description}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              <div>
                <span>Caught Count:</span> <strong className="text-white ml-1">{inspectingSpecies.caught_count}</strong>
              </div>
              <div>
                <span>First Discovered:</span>{' '}
                <strong className="text-white ml-1">
                  {inspectingSpecies.first_caught_at ? new Date(inspectingSpecies.first_caught_at).toLocaleDateString() : '—'}
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
