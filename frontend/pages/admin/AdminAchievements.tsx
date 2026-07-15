import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, ShieldAlert, Award, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { backendApi } from '../../services/api';
import toast from 'react-hot-toast';
import { AchievementIcon } from '../../components/AchievementIcon';

interface AchievementTier {
  achievement_id: string;
  tier: number;
  target_value: number;
  reward_points: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  tiers: AchievementTier[];
}

const AdminAchievements: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, { target_value: number; reward_points: number }>>({});
  const [savingTiers, setSavingTiers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setIsLoading(true);
      const data = await backendApi.getAdminAchievements();
      setAchievements(data);
    } catch (err: any) {
      toast.error('Failed to load achievements configuration');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (achievementId: string, tierNum: number, field: 'target_value' | 'reward_points', value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      const key = `${achievementId}_${tierNum}`;
      const currentTier = achievements
        .find(a => a.id === achievementId)
        ?.tiers.find(t => t.tier === tierNum);
      
      if (!currentTier) return;

      const currentEdits = editedValues[key] || {
        target_value: currentTier.target_value,
        reward_points: currentTier.reward_points
      };

      setEditedValues(prev => ({
        ...prev,
        [key]: {
          ...currentEdits,
          [field]: parsed
        }
      }));
    }
  };

  const handleSaveTier = async (achievementId: string, tierNum: number) => {
    const key = `${achievementId}_${tierNum}`;
    const edits = editedValues[key];
    if (!edits) return;

    try {
      setSavingTiers(prev => ({ ...prev, [key]: true }));
      const response = await backendApi.updateAchievementTier(achievementId, tierNum, edits.target_value, edits.reward_points);
      
      if (response.success) {
        toast.success(`Updated ${achievementId} Tier ${tierNum}`);
        
        // Update local achievements state
        setAchievements(prev => prev.map(a => {
          if (a.id !== achievementId) return a;
          return {
            ...a,
            tiers: a.tiers.map(t => {
              if (t.tier !== tierNum) return t;
              return {
                ...t,
                target_value: edits.target_value,
                reward_points: edits.reward_points
              };
            })
          };
        }));

        // Clear edited value state
        setEditedValues(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update criteria');
      console.error(err);
    } finally {
      setSavingTiers(prev => ({ ...prev, [key]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={40} className="animate-spin text-marine-500 mb-4" />
        <p>Loading achievements configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header and Back Link */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <span className="text-xs font-bold text-marine-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            Admin Panel <ChevronRight size={12} /> Achievements
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Achievements Settings</h1>
        </div>
      </div>

      {/* Warning/Alert */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-4 rounded-r-lg mb-8 flex gap-3">
        <ShieldAlert className="text-amber-500 flex-shrink-0" size={24} />
        <div>
          <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Caution when modifying criteria</h4>
          <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 leading-normal">
            Modifying achievement targets will immediately affect unlocked statuses. Decreasing a target value can unlock achievements for qualified users on their next transaction. Increasing a target value does not retroactively remove unlocked achievements, but users who haven't unlocked it yet will need to meet the new criteria.
          </p>
        </div>
      </div>

      {/* Achievements List */}
      <div className="space-y-8">
        {achievements.map((ach) => (
          <div key={ach.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header section with base details */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <AchievementIcon id={ach.id} tier={3} unlocked={true} size={56} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {ach.name}
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded capitalize">
                    {ach.category}
                  </span>
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{ach.description}</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">ID: <span className="font-mono">{ach.id}</span></p>
              </div>
            </div>

            {/* Tiers List */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {ach.tiers.map((t) => {
                const key = `${ach.id}_${t.tier}`;
                const tierName = t.tier === 1 ? 'Bronze' : t.tier === 2 ? 'Silver' : 'Gold';
                const hasEdits = editedValues[key] !== undefined;
                
                const targetVal = hasEdits ? editedValues[key].target_value : t.target_value;
                const rewardPoints = hasEdits ? editedValues[key].reward_points : t.reward_points;
                const isSaving = savingTiers[key] || false;

                return (
                  <div key={t.tier} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${
                          t.tier === 3 ? 'text-amber-500' : t.tier === 2 ? 'text-slate-400 dark:text-slate-300' : 'text-orange-500'
                        }`}>
                          {tierName} (Tier {t.tier})
                        </span>
                        {t.tier && (
                          <div className="opacity-80">
                            <AchievementIcon id={ach.id} tier={t.tier} unlocked={true} size={28} />
                          </div>
                        )}
                      </div>

                      {/* Inputs */}
                      <div className="space-y-4 mb-5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Target Threshold Value
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={targetVal}
                            onChange={(e) => handleInputChange(ach.id, t.tier, 'target_value', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-marine-500 focus:border-marine-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Reputation Points Reward
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={rewardPoints}
                            onChange={(e) => handleInputChange(ach.id, t.tier, 'reward_points', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-marine-500 focus:border-marine-500"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSaveTier(ach.id, t.tier)}
                      disabled={!hasEdits || isSaving}
                      className={`w-full py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        hasEdits && !isSaving
                          ? 'bg-marine-600 hover:bg-marine-700 text-white shadow-sm hover:shadow'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-400"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          Save Criteria
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Loader placeholder helper to prevent crash if Loader2 is undefined
const Loader2: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width={size} height={size}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default AdminAchievements;
