import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { backendApi } from '../services/api';
import { ApiPublicUser, ApiUserActivity, ApiCommunity } from '../types';
import { Loader2, Calendar, Shield, Globe, Award, Edit, User as UserIcon, ExternalLink, HelpCircle, Users, Pin, PinOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { parse, format, now } from '@/src/utils/datetime';
import { AchievementIcon } from '../components/AchievementIcon';
import { CONFIG } from '../config';

const ContributionHeatmap: React.FC<{ history: ApiUserActivity[] }> = ({ history }) => {
  // Determine date range (Last 365 days)
  const today = parse(format(parse(now()), 'YYYY-MM-DD'));
  const endDate = today;
  let startDate = today.subtract(365, 'day'); 
  
  // Adjust start date to previous Sunday to align grid
  const dayOfWeek = startDate.day(); // 0 is Sunday
  startDate = startDate.subtract(dayOfWeek, 'day');

  // Create array of days
  const days: any[] = [];
  let current = startDate;
  
  // Generate days until we catch up to today
  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
  }
  
  // Process history: Aggregate counts per day using local date strings
  const counts: Record<string, number> = {};
  if (history && Array.isArray(history)) {
      history.forEach(h => {
          if (!h.created_at) return;
          try {
              const dateObj = parse(h.created_at);
              const year = dateObj.year();
              const month = String(dateObj.month() + 1).padStart(2, '0');
              const d = String(dateObj.date()).padStart(2, '0');
              const dateStr = `${year}-${month}-${d}`;
              counts[dateStr] = (counts[dateStr] || 0) + 1;
          } catch (e) {
              // ignore invalid dates
          }
      });
  }

  // Improved Dark Mode Colors for better visibility ("pop")
  const getColor = (count: number) => {
      // Empty cells: Darker than the card background in dark mode to look like "slots"
      if (count === 0) return 'bg-slate-100 dark:bg-slate-900/50';
      
      // Activity levels
      if (count <= 2) return 'bg-marine-200 dark:bg-marine-900'; 
      if (count <= 5) return 'bg-marine-300 dark:bg-marine-700';
      if (count <= 9) return 'bg-marine-500 dark:bg-marine-500';
      
      // High activity: Brightest color with a subtle glow in dark mode
      return 'bg-marine-700 dark:bg-marine-300 dark:shadow-[0_0_8px_rgba(125,211,252,0.4)]';
  };

  return (
      <div className="w-full overflow-x-auto">
           <div className="flex items-end gap-2 mb-4">
               <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                   {history.length} contributions in the last year
               </h3>
           </div>
           <div className="min-w-fit">
              <div className="grid grid-rows-7 grid-flow-col gap-1 pb-2 h-[120px]">
                  {days.map(day => {
                      const year = day.year();
                      const month = String(day.month() + 1).padStart(2, '0');
                      const d = String(day.date()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${d}`;
                      const count = counts[dateStr] || 0;
                      return (
                          <div 
                              key={dateStr}
                              className={`w-3 h-3 rounded-sm ${getColor(count)} transition-all duration-200 hover:ring-1 hover:ring-slate-400 dark:hover:ring-slate-500`}
                              title={`${count} contributions on ${format(day, 'YYYY-MM-DD')}`}
                          ></div>
                      )
                  })}
              </div>
              <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span>Less</span>
                  <div className={`w-3 h-3 rounded-sm ${getColor(0)}`}></div>
                  <div className={`w-3 h-3 rounded-sm ${getColor(2)}`}></div>
                  <div className={`w-3 h-3 rounded-sm ${getColor(5)}`}></div>
                  <div className={`w-3 h-3 rounded-sm ${getColor(9)}`}></div>
                  <div className={`w-3 h-3 rounded-sm ${getColor(12)}`}></div>
                  <span>More</span>
              </div>
          </div>
      </div>
  );
};

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<ApiPublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<string[]>([]);
  const [nativeLanguage, setNativeLanguage] = useState<string | null>(null);
  const [extraData, setExtraData] = useState<any>({});
  const [history, setHistory] = useState<ApiUserActivity[]>([]);
  const [communities, setCommunities] = useState<ApiCommunity[]>([]);
  
  // Achievements State
  const [achievements, setAchievements] = useState<any[]>([]);
  const [pinnedList, setPinnedList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'achievements'>('activity');

  const fetchUserProfile = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const userData = await backendApi.getUser(id);
      setUserProfile(userData);

      // Parse Extra Data
      if (userData.extra) {
          try {
              const extra = JSON.parse(userData.extra);
              setExtraData(extra);
              if (extra.translationLanguages && Array.isArray(extra.translationLanguages)) {
                  setLanguages(extra.translationLanguages);
              }
              if (extra.nativeLanguage) {
                  setNativeLanguage(extra.nativeLanguage);
              }
              if (extra.pinnedAchievements && Array.isArray(extra.pinnedAchievements)) {
                  setPinnedList(extra.pinnedAchievements);
              }
          } catch (e) {
              console.error("Failed to parse user extra data", e);
          }
      }

      // Fetch User History for Graph
      try {
          const historyData = await backendApi.getUserHistory(id);
          setHistory(historyData);
      } catch (e) {
          console.error("Failed to fetch user history", e);
      }

      // Fetch User Communities
      try {
          const communitiesData = await backendApi.get<{communities: ApiCommunity[]}>(`/users/${id}/communities`);
          setCommunities(communitiesData.communities || []);
      } catch (e) {
          console.error("Failed to fetch user communities", e);
      }

      // Fetch User Achievements progress
      try {
          const achievementsData = await backendApi.getUserAchievements(id);
          setAchievements(achievementsData);
      } catch (e) {
          console.error("Failed to fetch user achievements", e);
      }

    } catch (error) {
      console.error("Failed to fetch user profile", error);
      toast.error("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={40} className="animate-spin text-marine-500 mb-4" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
            <UserIcon size={32} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">User not found</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">The user you are looking for does not exist.</p>
        <Link to="/leaderboard" className="inline-block mt-6 text-marine-600 hover:underline">
            View Community Leaderboard
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser && (String(currentUser.id) === String(userProfile.id) || String(currentUser.user_id) === String(userProfile.id));
  
  // Use Name from Extra if available, otherwise fallback
  const displayName = extraData.name || userProfile.name || userProfile.username;
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0ea5e9&color=fff&size=200`;

  // Determine reputation tier and calculate progress bar
  const getTier = (rep: number) => {
    if (rep >= 1000) return { name: 'Veteran', color: 'text-yellow-600 dark:text-yellow-400', barColor: 'bg-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', min: 1000, next: 2500 }; 
    if (rep >= 500) return { name: 'Trusted', color: 'text-teal-600 dark:text-teal-400', barColor: 'bg-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', min: 500, next: 1000 };
    if (rep >= 100) return { name: 'Regular', color: 'text-blue-600 dark:text-blue-400', barColor: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', min: 100, next: 500 };
    return { name: 'Contributor', color: 'text-slate-600 dark:text-slate-400', barColor: 'bg-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', min: 0, next: 100 };
  };

  const tier = getTier(userProfile.reputation);
  const progressPercent = Math.min(100, Math.max(0, ((userProfile.reputation - tier.min) / (tier.next - tier.min)) * 100));

  // Compute showcase badges:
  // If there are pinned achievements, filter by those.
  // Else, take the top 3 highest-unlocked achievements.
  const getShowcaseBadges = () => {
    const unlockedOnly = achievements.map(a => {
      const highestUnlockedTier = a.tiers.reduce((max: number, t: any) => {
        return t.unlocked && t.tier > max ? t.tier : max;
      }, 0);
      return {
        ...a,
        highestTier: highestUnlockedTier
      };
    }).filter(a => a.highestTier > 0);

    if (pinnedList.length > 0) {
      return pinnedList.map(pId => unlockedOnly.find(a => a.id === pId)).filter(Boolean) as any[];
    }

    return unlockedOnly.sort((a, b) => b.highestTier - a.highestTier).slice(0, 3);
  };

  const showcaseBadges = getShowcaseBadges();

  const handleTogglePin = async (achievementId: string) => {
    let newPinned = [...pinnedList];
    if (newPinned.includes(achievementId)) {
      newPinned = newPinned.filter(id => id !== achievementId);
    } else {
      if (newPinned.length >= 3) {
        toast.error("You can pin a maximum of 3 achievements to the showcase.");
        return;
      }
      newPinned.push(achievementId);
    }
    
    try {
      await fetch(`${CONFIG.API_URL}/user/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pinnedAchievements: newPinned
        })
      });
      setPinnedList(newPinned);
      toast.success(newPinned.includes(achievementId) ? "Achievement pinned to showcase!" : "Achievement unpinned.");
    } catch (err) {
      console.error("Failed to update pinned achievements", err);
      toast.error("Failed to update showcase pins.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-marine-600 to-teal-500"></div>
        <div className="px-8 pb-8">
            {/* Avatar & Edit Row */}
            <div className="relative flex justify-between items-end -mt-12 mb-6">
                <div className="relative">
                    <img 
                        src={avatarUrl} 
                        alt={displayName} 
                        className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-md bg-white dark:bg-slate-800"
                    />
                    {/* Admin Badge */}
                    {(userProfile as any).isAdmin && (
                        <div className="absolute bottom-1 right-1 bg-amber-500 text-white p-1.5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" title="Admin">
                            <Shield size={14} />
                        </div>
                    )}
                </div>
                {isOwnProfile && (
                    <Link 
                        to="/settings" 
                        className="mb-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
                    >
                        <Edit size={16} /> Edit Profile
                    </Link>
                )}
            </div>

            {/* User Info & Stats Row */}
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{displayName}</h1>
                    
                    {extraData.orcid ? (
                        <a 
                            href={`https://orcid.org/${extraData.orcid}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-marine-600 dark:text-marine-400 hover:underline mb-4 font-medium"
                        >
                            <img src="https://orcid.org/sites/default/files/images/orcid_16x16.png" alt="ORCID" className="w-4 h-4" />
                            https://orcid.org/{extraData.orcid} <ExternalLink size={14} />
                        </a>
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
                            @{userProfile.username}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={16} />
                            Joined {format(parse(userProfile.joined_at), 'YYYY-MM-DD')}
                        </div>
                        {nativeLanguage && (
                            <div className="flex items-center gap-1.5">
                                <Globe size={16} />
                                Native: <span className="font-semibold uppercase">{nativeLanguage}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side Group: Reputation Bar, Languages, Achievements Showcase */}
                <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                    
                    {/* Reputation Bar */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 min-w-[200px] flex-1 sm:flex-initial flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Award size={14} /> Reputation
                            </h3>
                             <Link to="/reputation" title="Learn how to earn points" className="text-slate-400 hover:text-marine-600 transition-colors">
                                <HelpCircle size={14} />
                            </Link>
                        </div>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{userProfile.reputation}</span>
                            <span className={`text-xs font-medium ${tier.color} mb-0.5`}>{tier.name}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1" title={`${tier.next - userProfile.reputation} points to next tier`}>
                            <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ${tier.barColor}`} 
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 text-right">
                             {tier.next - userProfile.reputation} to next tier
                        </div>
                    </div>

                    {/* Achievements Showcase Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 min-w-[200px] flex-1 sm:flex-initial flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Award size={14} /> Showcase
                            </h3>
                        </div>
                        <div className="flex gap-4 items-center justify-center py-1">
                            {showcaseBadges.length > 0 ? (
                                showcaseBadges.map(badge => (
                                    <div key={badge.id} title={`${badge.name} (Tier ${badge.highestTier})`} className="relative group/showcase">
                                        <AchievementIcon id={badge.id} tier={badge.highestTier} unlocked={true} size={42} />
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-slate-400 py-3 italic">No badges showcased</span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 text-center">
                            Pinned achievements
                        </div>
                    </div>

                    {/* Languages Box */}
                    {languages.length > 0 && (
                         <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 min-w-[200px] flex-1 sm:flex-initial">
                             <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                 <Globe size={14} /> Languages
                             </h3>
                             <div className="flex flex-wrap gap-2">
                                 {languages.map(lang => (
                                     <span key={lang} className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium uppercase shadow-sm">
                                         {lang}
                                     </span>
                                 ))}
                             </div>
                         </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'activity'
              ? 'border-marine-500 text-marine-600 dark:text-marine-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'achievements'
              ? 'border-marine-500 text-marine-600 dark:text-marine-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Award size={16} />
          Achievements
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'activity' && (
        <>
          {/* Activity Section - Full Width */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contribution Activity</h3>
                  {isOwnProfile && (
                    <Link to="/dashboard" className="text-sm text-marine-600 hover:underline">
                        View Dashboard
                    </Link>
                  )}
              </div>
              
              <ContributionHeatmap history={history} />
          </div>

          {/* Communities Section */}
          {communities.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users size={20} />
                  Communities ({communities.length})
                </h3>
                <Link to="/communities" className="text-sm text-marine-600 hover:underline">
                  View All Communities
                </Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {communities.map((community) => (
                  <Link
                    key={community.id}
                    to={`/communities/${community.id}`}
                    className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-marine-500 dark:hover:border-marine-500 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {community.type === 'language' ? (
                        <Globe className="text-blue-600 dark:text-blue-400" size={16} />
                      ) : (
                        <Users className="text-purple-600 dark:text-purple-400" size={16} />
                      )}
                      <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                        {community.name}
                      </h4>
                    </div>
                    {community.role && (
                      <span className="inline-block text-xs bg-marine-100 dark:bg-marine-900/30 text-marine-700 dark:text-marine-400 px-2 py-1 rounded capitalize">
                        {community.role}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'achievements' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Achievements Grid</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Track your progress and unlock marine badges. Click tiers to view criteria and global rarity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((ach) => {
              // Determine current tier progress details
              const highestUnlocked = ach.tiers.reduce((max: number, t: any) => t.unlocked && t.tier > max ? t.tier : max, 0);
              const nextTier = ach.tiers.find((t: any) => !t.unlocked) || ach.tiers[ach.tiers.length - 1];
              
              // Calculate progress percent
              const baseVal = highestUnlocked === 0 ? 0 : ach.tiers[highestUnlocked - 1].target_value;
              const targetVal = nextTier.target_value;
              const currentVal = Math.min(ach.currentProgress, targetVal);
              const progressRange = targetVal - baseVal;
              const progressCurrent = currentVal - baseVal;
              const progressPct = progressRange > 0 ? Math.max(0, Math.min(100, (progressCurrent / progressRange) * 100)) : 100;

              return (
                <div key={ach.id} className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-900 flex flex-col justify-between relative group hover:shadow-md transition-shadow">
                  {/* Pin to Showcase Button */}
                  {isOwnProfile && highestUnlocked > 0 && (
                    <button
                      onClick={() => handleTogglePin(ach.id)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-marine-500 transition-colors"
                      title={pinnedList.includes(ach.id) ? "Unpin from showcase" : "Pin to showcase"}
                    >
                      {pinnedList.includes(ach.id) ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                  )}

                  <div className="flex gap-4 items-start mb-4">
                    <div className="flex-shrink-0">
                      {/* Show current tier representation icon (use highest unlocked, or bronze/locked icon) */}
                      <AchievementIcon id={ach.id} tier={highestUnlocked || 1} unlocked={highestUnlocked > 0} size={72} />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                        {ach.name}
                        {highestUnlocked > 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                            highestUnlocked === 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                            highestUnlocked === 2 ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' :
                            'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                          }`}>
                            {highestUnlocked === 3 ? 'Gold' : highestUnlocked === 2 ? 'Silver' : 'Bronze'}
                          </span>
                        )}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-normal">{ach.description}</p>
                    </div>
                  </div>

                  {/* Progress info */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                      <span>Progress</span>
                      <span>{ach.currentProgress} / {targetVal}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                      <div 
                        className="bg-marine-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Tiers metadata section */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-900 grid grid-cols-3 gap-2">
                    {ach.tiers.map((t: any) => {
                      const tierName = t.tier === 1 ? 'Bronze' : t.tier === 2 ? 'Silver' : 'Gold';
                      return (
                        <div 
                          key={t.tier} 
                          className={`text-center p-2 rounded-lg relative group/tier cursor-help transition-all ${
                            t.unlocked 
                              ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
                              : 'bg-slate-100/50 dark:bg-slate-950/30 border border-transparent opacity-60'
                          }`}
                        >
                          <span className={`text-[10px] font-bold block ${
                            t.unlocked 
                              ? (t.tier === 3 ? 'text-amber-500' : t.tier === 2 ? 'text-slate-400 dark:text-slate-300' : 'text-orange-500')
                              : 'text-slate-400'
                          }`}>
                            {tierName}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.target_value}</span>
                          
                          {/* Rich hover details / Tooltip */}
                          <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[11px] p-2.5 rounded-lg opacity-0 pointer-events-none group-hover/tier:opacity-100 group-hover/tier:pointer-events-auto transition-opacity duration-200 shadow-xl border border-slate-800 text-left">
                            <p className="font-bold text-slate-300 uppercase text-[9px] mb-1">{ach.name} - Tier {t.tier}</p>
                            <p className="mb-1 text-slate-100">Target: <span className="font-semibold">{t.target_value}</span></p>
                            <p className="mb-1 text-slate-100">Reward: <span className="font-semibold">{t.reward_points} reputation</span></p>
                            <p className="mb-1 text-slate-100">Status: <span className={t.unlocked ? 'text-green-400 font-semibold' : 'text-slate-400'}>
                              {t.unlocked ? 'Unlocked ✓' : 'Locked ✗'}
                            </span></p>
                            {t.unlocked_at && (
                              <p className="mb-1 text-slate-400">Unlocked: {format(parse(t.unlocked_at), 'YYYY-MM-DD')}</p>
                            )}
                            <p className="border-t border-slate-800 pt-1 mt-1 text-[10px] text-marine-300">
                              Unlocked by {t.unlockedPercentage}% of users
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
