
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Award, TrendingUp, Clock, ChevronRight, Activity, Zap, Settings, ArrowRight, MessageSquare, MessageCircle, FileText, PlusCircle, Check, X, Loader2, Globe, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { backendApi } from '../services/api';
import { ApiTerm, ApiUserActivity, ApiPublicUser, ApiLanguage } from '../types';
import toast from 'react-hot-toast';
import { parse, fromNow } from '@/src/utils/datetime';
import LanguagePreferencePrompt from '../components/LanguagePreferencePrompt';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activityCount: 0,
    reputation: 0,
    rank: 0,
    needsTranslationCount: 0
  });
  const [activities, setActivities] = useState<ApiUserActivity[]>([]);
  const [termsMap, setTermsMap] = useState<Record<number, { label: string; uri: string }>>({});
  const [userLanguages, setUserLanguages] = useState<string[]>([]);
  const [selectedFlowLanguage, setSelectedFlowLanguage] = useState<string>('');
  const [languagesMap, setLanguagesMap] = useState<Map<string, string>>(new Map());

  // Tabs and lazy loading state
  const [activeTab, setActiveTab] = useState<'overview' | 'discussions_drafts' | 'vocabulary_requests'>('overview');
  const [userDiscussions, setUserDiscussions] = useState<any[]>([]);
  const [userDrafts, setUserDrafts] = useState<any[]>([]);
  const [vocabRequests, setVocabRequests] = useState<any[]>([]);
  const [loadingTabContent, setLoadingTabContent] = useState(false);
  
  // Vocabulary Request Form state
  const [reqTitle, setReqTitle] = useState('');
  const [reqSourceUri, setReqSourceUri] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  
  // Admin response state
  const [adminNotesMap, setAdminNotesMap] = useState<Record<number, string>>({});
  const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id && !user?.user_id) return; // Check for user ID

      try {
        setLoading(true);

        // Fetch data in parallel including user preferences and languages
        const [history, users, preferences, languagesData] = await Promise.all([
          backendApi.getUserHistory(user.id || user.user_id!), // Use user ID
          backendApi.getUsers(),
          backendApi.get<{ nativeLanguage: string; translationLanguages: string[] }>('/user/preferences').catch(() => ({ nativeLanguage: '', translationLanguages: [] })),
          backendApi.get<ApiLanguage[]>('/languages').catch(() => [])
        ]);

        // Set languages from API and create a map for O(1) lookups
        const langMap = new Map<string, string>();
        languagesData.forEach(lang => {
          langMap.set(lang.code, lang.name);
        });
        setLanguagesMap(langMap);

        // Set user's translation languages
        const userLangs = preferences.translationLanguages || [];
        setUserLanguages(userLangs);
        if (userLangs.length > 0) {
          setSelectedFlowLanguage(userLangs[0]);
        }

        // 1. Extract unique term IDs from history and fetch only those terms
        const termIds = [...new Set(history.map(h => h.term_id).filter(id => id != null))] as number[];
        
        let termIdToInfo: Record<number, { label: string; uri: string }> = {};
        if (termIds.length > 0) {
          const terms = await backendApi.getTermsByIds(termIds);
          terms.forEach((t: ApiTerm) => {
            // Map ID to both Label and URI for activity feed lookup
            // Add safety check for fields being undefined
            if (t.fields && Array.isArray(t.fields)) {
              const labelField = t.fields.find(f => f.field_role === 'label')
                || t.fields.find(f => f.field_uri?.includes('prefLabel'));
              const prefLabel = labelField?.original_value || t.uri || 'Unknown Term';
              termIdToInfo[t.id] = { label: prefLabel, uri: t.uri };
            } else {
              termIdToInfo[t.id] = { label: t.uri || 'Unknown Term', uri: t.uri };
            }
          });
        }
        setTermsMap(termIdToInfo);

        // 2. Process User Ranking & Reputation
        const sortedUsers = users.sort((a: ApiPublicUser, b: ApiPublicUser) => b.reputation - a.reputation);
        const currentUserData = sortedUsers.find(u => u.username === user.username);
        const rank = sortedUsers.findIndex(u => u.username === user.username) + 1;

        // 3. Process History
        // Sort by created_at desc just in case API doesn't
        const sortedHistory = history.sort((a, b) => 
          parse(b.created_at).valueOf() - parse(a.created_at).valueOf()
        );

        setActivities(sortedHistory.slice(0, 5)); // Top 5 recent
        setStats({
          activityCount: history.length,
          reputation: currentUserData?.reputation || 0,
          rank: rank > 0 ? rank : users.length + 1,
          needsTranslationCount: 0 // This is now calculated server-side if needed
        });

      } catch (error) {
        console.error("Dashboard data fetch failed:", error);
        toast.error("Failed to load dashboard statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.username]);

  // Load tab content when active tab changes
  useEffect(() => {
    const fetchTabContent = async () => {
      if (!user?.id && !user?.user_id) return;
      
      if (activeTab === 'overview') return;
      
      setLoadingTabContent(true);
      try {
        if (activeTab === 'discussions_drafts') {
          const [discussionsRes, draftsRes] = await Promise.all([
            backendApi.getUserDiscussions(),
            backendApi.getUserDrafts()
          ]);
          setUserDiscussions(discussionsRes);
          setUserDrafts(draftsRes);
        } else if (activeTab === 'vocabulary_requests') {
          const requestsRes = await backendApi.getVocabularyRequests();
          setVocabRequests(requestsRes);
          
          // Pre-populate admin notes map with existing notes
          const notes: Record<number, string> = {};
          requestsRes.forEach((r: any) => {
            notes[r.id] = r.admin_notes || '';
          });
          setAdminNotesMap(notes);
        }
      } catch (err) {
        console.error("Failed to load tab content:", err);
        toast.error("Failed to load list data");
      } finally {
        setLoadingTabContent(false);
      }
    };
    
    fetchTabContent();
  }, [activeTab, user?.id, user?.user_id]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqSourceUri.trim()) {
      toast.error("Title and Source URI are required");
      return;
    }
    
    setIsSubmittingRequest(true);
    try {
      const newRequest = await backendApi.createVocabularyRequest({
        title: reqTitle.trim(),
        sourceUri: reqSourceUri.trim(),
        description: reqDescription.trim() || undefined
      });
      toast.success("Vocabulary request submitted successfully!");
      setVocabRequests(prev => [newRequest, ...prev]);
      setReqTitle('');
      setReqSourceUri('');
      setReqDescription('');
    } catch (err: any) {
      console.error("Failed to submit request:", err);
      toast.error(err.message || "Failed to submit request");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    setUpdatingRequestId(id);
    try {
      const updated = await backendApi.updateVocabularyRequestStatus(id, {
        status,
        adminNotes: adminNotesMap[id] || undefined
      });
      toast.success(`Request status updated to ${status}`);
      setVocabRequests(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const formatActivityAction = (action: string) => {
    switch (action) {
      case 'translation_created': return 'Created translation';
      case 'translation_edited': return 'Edited translation';
      case 'translation_approved': return 'Approved translation';
      case 'term_uri_changed': return 'Updated term URI';
      default: return action.replace('_', ' ');
    }
  };

  const getRelativeTime = (dateString: string) => {
    return fromNow(parse(dateString));
  };

  const getLanguageName = (code: string) => {
    // O(1) lookup using Map
    return languagesMap.get(code) || code.toUpperCase();
  };

  const parseExtra = (extra: string | null) => {
    if (!extra) return null;
    try {
      const data = JSON.parse(extra);
      // Construct a friendly string based on common extra fields
      if (data.language && data.value) {
        return `"${data.value}" (${data.language.toUpperCase()})`;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Settings Button */}
      <div className="mb-8 relative">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white pr-12 md:pr-0">Welcome back, {user?.name.split(' ')[0]}!</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Here's what's happening with your contributions.</p>
        
        {/* Settings Button - Mobile Only */}
        <Link 
          to="/settings"
          className="md:hidden absolute top-0 right-0 p-2 text-slate-600 dark:text-slate-400 hover:text-marine-600 dark:hover:text-marine-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Settings"
        >
          <Settings size={24} />
        </Link>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-8 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-4 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-marine-500 text-marine-600 dark:text-marine-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Activity size={16} /> Overview
        </button>
        <button
          onClick={() => setActiveTab('discussions_drafts')}
          className={`py-4 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'discussions_drafts'
              ? 'border-marine-500 text-marine-600 dark:text-marine-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <MessageCircle size={16} /> Discussions & Drafts
        </button>
        <button
          onClick={() => setActiveTab('vocabulary_requests')}
          className={`py-4 px-6 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'vocabulary_requests'
              ? 'border-marine-500 text-marine-600 dark:text-marine-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <PlusCircle size={16} /> Vocabulary Requests
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Language Preference Prompt */}
          <LanguagePreferencePrompt hasConfiguredLanguages={userLanguages.length > 0} />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Activity Card */}
            <Link to="/history" className="group bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center hover:shadow-md hover:border-marine-300 dark:hover:border-marine-600 transition-all cursor-pointer">
              <div className="p-3 bg-marine-100 dark:bg-marine-900 text-marine-600 dark:text-marine-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                <Activity size={24} />
              </div>
              <div className="flex-grow">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your Activity</p>
                <div className="flex items-baseline gap-2">
                   {loading ? (
                       <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1"></div>
                   ) : (
                       <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activityCount}</p>
                   )}
                   <span className="text-xs text-slate-400">actions</span>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-marine-500 transition-colors" size={20} />
            </Link>
            
            {/* Reputation Card */}
            <Link to="/reputation" className="group bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600 transition-all cursor-pointer">
              <div className="p-3 bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                <Award size={24} />
              </div>
              <div className="flex-grow">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Reputation Score</p>
                 {loading ? (
                     <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1"></div>
                 ) : (
                     <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.reputation}</p>
                 )}
              </div>
               <ChevronRight className="text-slate-300 group-hover:text-teal-500 transition-colors" size={20} />
            </Link>

            {/* Leaderboard Card */}
            <Link to="/leaderboard" className="group bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div className="flex-grow">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Global Rank</p>
                 {loading ? (
                     <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mt-1"></div>
                 ) : (
                     <p className="text-2xl font-bold text-slate-900 dark:text-white">#{stats.rank}</p>
                 )}
              </div>
               <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={20} />
            </Link>
          </div>

          {/* Blog Teaser Banner */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-marine-400 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-marine-50 dark:bg-marine-950 text-marine-600 dark:text-marine-400 rounded-xl">
                 <BookOpen size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-marine-600 dark:text-marine-400 uppercase tracking-widest">Platform News</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Lost in Translation? Not Your Marine Data - EMODnet Launches self-hosted platform!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  Read Conor Delaney's announcement of our ready-to-use self-hosted translation infrastructure.
                </p>
              </div>
            </div>
            <Link 
              to="/blog/lost-in-translation-not-your-marine-data" 
              className="flex-shrink-0 px-5 py-2.5 bg-marine-600 hover:bg-marine-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              Read Blogpost & Watch Video <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Call to Action */}
            <div className="lg:col-span-2 bg-gradient-to-r from-marine-600 to-marine-800 rounded-xl p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Ready to Contribute?</h3>
                <p className="text-marine-100 mb-6 max-w-md">
                  {loading 
                    ? "Analyzing terms library..." 
                    : `There are approximately ${stats.needsTranslationCount} terms waiting for plain English definitions or translations in your language.`
                  }
                </p>
                {userLanguages.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <label htmlFor="flow-language" className="block text-sm font-medium text-marine-100 mb-2">
                        Select language for Flow Mode:
                      </label>
                      <select
                        id="flow-language"
                        value={selectedFlowLanguage}
                        onChange={(e) => setSelectedFlowLanguage(e.target.value)}
                        className="w-full max-w-xs px-4 py-2 rounded-lg bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-marine-300"
                      >
                        {userLanguages.map((lang) => (
                          <option key={lang} value={lang}>
                            {getLanguageName(lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Link 
                        to={`/flow?language=${selectedFlowLanguage}`} 
                        className="inline-flex items-center px-5 py-2.5 bg-white text-marine-700 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
                      >
                        <Zap size={18} className="mr-2 fill-marine-700" /> Enter Flow Mode
                      </Link>
                      <Link to="/browse" className="inline-flex items-center px-5 py-2.5 bg-marine-700/50 text-white font-semibold rounded-lg hover:bg-marine-700 transition-colors border border-marine-500">
                        Browse All Terms
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 p-4 bg-marine-700/50 rounded-lg border border-marine-500">
                      <p className="text-sm text-marine-100">
                        Please set your translation languages in your{' '}
                        <Link to="/profile" className="underline font-semibold hover:text-white">
                          profile settings
                        </Link>
                        {' '}to use Flow Mode.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Link to="/browse" className="inline-flex items-center px-5 py-2.5 bg-white text-marine-700 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-sm">
                        Browse All Terms
                      </Link>
                    </div>
                  </>
                )}
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                 <BookOpen size={200} />
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 min-h-[300px]">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-slate-400" /> Recent Activity
              </h3>
              
              <div className="space-y-4">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="flex items-start pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <div className="w-2 h-2 mt-2 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"></div>
                      <div className="space-y-2 w-full">
                         <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                         <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))
                ) : activities.length > 0 ? (
                  activities.map((activity) => {
                    const termInfo = activity.term_id ? termsMap[activity.term_id] : null;
                    const termLabel = termInfo?.label || 'Deleted Term';
                    const termUri = termInfo?.uri || '';
                    const details = parseExtra(activity.extra);
                    
                    return (
                      <div key={activity.id} className="flex items-start pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
                        <div className="w-2 h-2 mt-2 rounded-full bg-marine-500 mr-3 flex-shrink-0"></div>
                        <div>
                          <p className="text-sm text-slate-800 dark:text-slate-200">
                            <span className="capitalize font-medium">{formatActivityAction(activity.action)}</span>
                            {' '}for{' '}
                            {termUri ? (
                              <Link to={`/term/${encodeURIComponent(termUri)}`} className="font-medium text-marine-600 hover:underline">
                                "{termLabel}"
                              </Link>
                            ) : (
                              <span className="font-medium text-slate-500">
                                "{termLabel}"
                              </span>
                            )}
                          </p>
                          {details && (
                              <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-0.5">
                                  {details}
                              </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">{getRelativeTime(activity.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                     No recent activity found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'discussions_drafts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
          {/* Discussions Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <MessageCircle size={20} className="text-marine-500" /> My Discussions ({userDiscussions.length})
            </h3>
            
            {loadingTabContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 size={32} className="animate-spin text-marine-500 mb-2" />
                <p className="text-sm">Loading discussions...</p>
              </div>
            ) : userDiscussions.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {userDiscussions.map((disc) => (
                  <Link
                    key={disc.id}
                    to={`/term/${encodeURIComponent(disc.term_uri)}`}
                    className="block p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all hover:shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="text-md font-bold text-slate-900 dark:text-white line-clamp-1">{disc.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                        disc.status === 'open' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {disc.status}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Term: <span className="font-semibold text-marine-600 dark:text-marine-400">{disc.term_label || disc.term_uri.split('/').pop()}</span>
                    </p>
                    
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Started by {disc.started_by}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} /> {disc.message_count} message{disc.message_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <MessageCircle className="mx-auto mb-3 opacity-20" size={48} />
                <p className="text-sm">You haven't participated in any discussions yet.</p>
                <Link to="/browse" className="inline-block mt-4 text-xs font-semibold text-marine-500 hover:underline">Browse terms and join conversations</Link>
              </div>
            )}
          </div>

          {/* Drafts Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <FileText size={20} className="text-teal-500" /> My Pending Drafts ({userDrafts.length})
            </h3>
            
            {loadingTabContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 size={32} className="animate-spin text-teal-500 mb-2" />
                <p className="text-sm">Loading drafts...</p>
              </div>
            ) : userDrafts.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {userDrafts.map((draft) => (
                  <Link
                    key={draft.id}
                    to={`/term/${encodeURIComponent(draft.term_uri)}`}
                    className="block p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold rounded uppercase">
                        {draft.language}
                      </span>
                      <span className="text-xs text-slate-400">Draft</span>
                    </div>
                    
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 italic">
                      "{draft.value.length > 120 ? draft.value.substring(0, 120) + '...' : draft.value}"
                    </p>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Term: <span className="font-semibold text-marine-600 dark:text-marine-400">{draft.term_label || draft.term_uri.split('/').pop()}</span>
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <FileText className="mx-auto mb-3 opacity-20" size={48} />
                <p className="text-sm">You have no active drafts at the moment.</p>
                <Link to="/browse" className="inline-block mt-4 text-xs font-semibold text-marine-500 hover:underline">Start translating new terms</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vocabulary_requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          {/* Submit Request Form */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 h-fit">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-marine-500" /> Request New Vocabulary
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Request a new vocabulary/NERC collection/LDES feed to be imported and synced into the platform.
            </p>
            
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label htmlFor="req-title" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Vocabulary Name *
                </label>
                <input
                  id="req-title"
                  type="text"
                  placeholder="e.g. BODC SeaDataNet Platform Categories"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="req-uri" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Source Link / URI *
                </label>
                <input
                  id="req-uri"
                  type="text"
                  placeholder="e.g. http://vocab.nerc.ac.uk/collection/L06/current/"
                  value={reqSourceUri}
                  onChange={(e) => setReqSourceUri(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="req-description" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Description / Motivation
                </label>
                <textarea
                  id="req-description"
                  placeholder="e.g. Why is this vocabulary needed? What fields are important?"
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                  rows={3}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="w-full py-2 bg-marine-600 hover:bg-marine-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingRequest ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                Submit Request
              </button>
            </form>
          </div>

          {/* List Requests Section */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Zap size={20} className="text-yellow-500 animate-pulse" /> 
              {user?.isAdmin ? "All Vocabulary Requests" : "My Vocabulary Requests"} ({vocabRequests.length})
            </h3>
            
            {loadingTabContent ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 size={40} className="animate-spin text-marine-500 mb-4" />
                <p>Loading requests...</p>
              </div>
            ) : vocabRequests.length > 0 ? (
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                {vocabRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-md font-bold text-slate-900 dark:text-white">{req.title}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Requested by {req.requested_by} • {getRelativeTime(req.created_at)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {user?.isAdmin ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={req.status}
                              onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                              disabled={updatingRequestId === req.id}
                              className={`px-2 py-1 rounded text-xs font-semibold border ${
                                req.status === 'completed' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                req.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                req.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            req.status === 'completed' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                            req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                            req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs space-y-1.5">
                      <p className="text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-500 dark:text-slate-400">URI:</strong>{' '}
                        <a href={req.source_uri} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-400 hover:underline break-all">
                          {req.source_uri}
                        </a>
                      </p>
                      {req.description && (
                        <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          <strong className="text-slate-500 dark:text-slate-400 block mb-0.5">Description:</strong>
                          {req.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Admin notes edit/display */}
                    {user?.isAdmin ? (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <label htmlFor={`notes-${req.id}`} className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Admin Notes / Comments
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`notes-${req.id}`}
                            type="text"
                            placeholder="Add reason for approval/rejection or sync log..."
                            value={adminNotesMap[req.id] || ''}
                            onChange={(e) => setAdminNotesMap({ ...adminNotesMap, [req.id]: e.target.value })}
                            className="flex-grow px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                          />
                          <button
                            onClick={() => handleUpdateStatus(req.id, req.status)}
                            disabled={updatingRequestId === req.id}
                            className="px-3 py-1 bg-marine-600 hover:bg-marine-700 text-white rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      req.admin_notes && (
                        <div className="mt-2 bg-amber-50 dark:bg-slate-800/80 p-2.5 rounded border border-amber-100 dark:border-slate-700 text-xs">
                          <strong className="text-amber-800 dark:text-amber-400 block mb-0.5">Admin Response:</strong>
                          <p className="text-slate-700 dark:text-slate-300 italic">{req.admin_notes}</p>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500">
                <Zap className="mx-auto mb-3 opacity-20" size={48} />
                <p className="text-sm">No vocabulary requests submitted yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;