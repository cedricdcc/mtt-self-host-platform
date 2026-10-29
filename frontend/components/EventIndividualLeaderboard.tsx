import React from 'react';
import { Trophy, Award, User as UserIcon } from 'lucide-react';
import { IndividualLeaderboardEntry } from '../types';

interface EventIndividualLeaderboardProps {
  contributors: IndividualLeaderboardEntry[];
  currentUserId?: number;
}

export const EventIndividualLeaderboard: React.FC<EventIndividualLeaderboardProps> = ({
  contributors,
  currentUserId
}) => {
  const top3 = contributors.slice(0, 3);
  const remaining = contributors.slice(3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" /> Individual Leaderboard
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {contributors.length} active contributors
        </span>
      </div>

      {contributors.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
          No individual contributions recorded yet. Start translating to take the top spot!
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {top3.map((entry, idx) => {
              const isMe = currentUserId && entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`bg-white dark:bg-slate-800/90 border rounded-2xl p-6 shadow-lg relative overflow-hidden transition ${
                    isMe
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                      : idx === 0
                      ? "border-amber-400 dark:border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent"
                      : idx === 1
                      ? "border-slate-300 dark:border-slate-500/50 bg-gradient-to-b from-slate-400/10 via-slate-400/5 to-transparent"
                      : "border-amber-700/40 dark:border-amber-700/50 bg-gradient-to-b from-amber-700/10 via-amber-700/5 to-transparent"
                  }`}
                >
                  {isMe && (
                    <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-[10px] uppercase rounded-full shadow-sm">
                      ✓ You
                    </div>
                  )}

                  <div className="text-3xl mb-2">
                    {idx === 0 ? "🥇 1st Place" : idx === 1 ? "🥈 2nd Place" : "🥉 3rd Place"}
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-2">
                    <UserIcon size={18} className="text-slate-400" />
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate max-w-[200px]">
                      {entry.name}
                    </h3>
                  </div>

                  <p className="text-cyan-600 dark:text-cyan-400 font-mono font-extrabold text-2xl">
                    {entry.totalPoints} pts
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {entry.translationsCount} translations
                  </p>
                </div>
              );
            })}
          </div>

          {/* 4th Place Onwards */}
          {remaining.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Other Contributors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {remaining.map((entry, idx) => {
                  const isMe = currentUserId && entry.userId === currentUserId;
                  return (
                    <div
                      key={entry.userId}
                      className={`bg-white dark:bg-slate-800/90 border rounded-xl p-4 flex items-center justify-between shadow-sm transition ${
                        isMe
                          ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-400 text-sm">#{idx + 4}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {entry.name}
                            </span>
                            {isMe && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.translationsCount} translations
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {entry.totalPoints} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventIndividualLeaderboard;
