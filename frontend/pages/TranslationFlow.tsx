import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getNotification } from '../services/notification.api';
import toast from 'react-hot-toast';
import { Sparkles, Home, TrendingUp } from 'lucide-react';
import FlowTermCard from '../components/FlowTermCard';
import FlowStatsPanel from '../components/FlowStatsPanel';
import {
  startFlowSession,
  getNextTask,
  submitReview,
  getAvailableLanguages,
  endFlowSession,
  getFlowStats,
  getTranslationTask,
  skipTask,
  FlowTask,
  UserStats,
  DailyChallenge,
  DailyGoal,
  Language,
} from '../services/flow.api';
import { backendApi } from '../services/api';
import { ApiCommunityGoal, ApiCommunityGoalProgress } from '../types';

const TranslationFlow: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLanguage = searchParams.get('language') || undefined;
  const selectedSource = searchParams.get('source') || undefined;
  const translationIdParam = searchParams.get('translation_id');

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentTask, setCurrentTask] = useState<FlowTask | null>(null);
  const [linkedNotification, setLinkedNotification] = useState<any | null>(null);
  const clearingParamsRef = useRef(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [sessionTranslations, setSessionTranslations] = useState(0);
  const [sessionReviews, setSessionReviews] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [relevantGoal, setRelevantGoal] = useState<{ goal: ApiCommunityGoal; progress: ApiCommunityGoalProgress } | null>(null);

  // Initialize flow session
  useEffect(() => {
    const initFlow = async () => {
      // If we are already initialized and the URL param/hash was just cleared, skip this effect run.
      if (clearingParamsRef.current) {
        clearingParamsRef.current = false;
        return;
      }

      try {
        setIsLoading(true);

        // Parse notification ID from hash
        let notificationId: number | null = null;
        if (location.hash && location.hash.startsWith('#notification-')) {
          const idStr = location.hash.replace('#notification-', '');
          const idVal = parseInt(idStr, 10);
          if (!isNaN(idVal)) {
            notificationId = idVal;
          }
        }

        // Fetch session data, languages, and notification (if exists) in parallel
        const promises: Promise<any>[] = [
          startFlowSession(selectedLanguage, selectedSource),
          getAvailableLanguages(),
        ];
        
        if (notificationId) {
          promises.push(getNotification(notificationId).catch(err => {
            console.error('Failed to fetch linked notification:', err);
            return null;
          }));
        }

        const results = await Promise.all(promises);
        const sessionData = results[0];
        const languagesData = results[1];
        const notifResult = notificationId ? results[2] : null;

        setSessionId(sessionData.sessionId);
        setStats(sessionData.stats);
        setChallenges(sessionData.challenges);
        setDailyGoal(sessionData.dailyGoal);
        setLanguages(languagesData.languages);

        let activeNotification = null;
        if (notifResult && notifResult.notification) {
          activeNotification = notifResult.notification;
          setLinkedNotification(notifResult.notification);
        }

        // Determine which translation to load
        let targetTranslationId = translationIdParam ? parseInt(translationIdParam) : null;
        if (!targetTranslationId && activeNotification) {
          targetTranslationId = activeNotification.translation_id;
        }

        // If a specific translation needs loading (from notification or direct link)
        if (targetTranslationId) {
          try {
            const task = await getTranslationTask(targetTranslationId);
            
            // Map taskType to type for compatibility
            if (task && !task.type && (task as any).taskType) {
              task.type = (task as any).taskType;
            }
            setCurrentTask(task);
            
            // Clean up the URL query param and hash after loading
            clearingParamsRef.current = true;
            navigate({
              pathname: location.pathname,
              search: new URLSearchParams({
                ...(selectedLanguage && { language: selectedLanguage }),
                ...(selectedSource && { source: selectedSource })
              }).toString(),
              hash: ''
            }, { replace: true });
            
            // Fetch relevant community goal
            if (task && task.task) {
              await fetchRelevantGoal(task);
            }
          } catch (error) {
            console.error('Failed to load translation from notification:', error);
            toast.error('Translation not found. Loading next task...');
            
            // Fall back to getting next task
            const task = await getNextTask(selectedLanguage, selectedSource);
            setCurrentTask(task);
            
            // Clear search params and hash on fallback
            clearingParamsRef.current = true;
            navigate({
              pathname: location.pathname,
              search: new URLSearchParams({
                ...(selectedLanguage && { language: selectedLanguage }),
                ...(selectedSource && { source: selectedSource })
              }).toString(),
              hash: ''
            }, { replace: true });

            if (task && task.task) {
              await fetchRelevantGoal(task);
            }
          }
        } else {
          // Get first task normally
          const task = await getNextTask(selectedLanguage, selectedSource);
          setCurrentTask(task);
          
          // Fetch relevant community goal for the first task
          if (task && task.task) {
            await fetchRelevantGoal(task);
          }
        }
      } catch (error) {
        console.error('Failed to initialize flow:', error);
        toast.error('Failed to start translation flow');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      initFlow();
    }
  }, [user, selectedLanguage, selectedSource, translationIdParam, location.hash]);

  // Load next task
  const loadNextTask = async () => {
    try {
      const task = await getNextTask(selectedLanguage, selectedSource);
      setCurrentTask(task);
      
      // Fetch relevant community goal for this task
      if (task && task.task) {
        await fetchRelevantGoal(task);
      }
    } catch (error) {
      console.error('Failed to load next task:', error);
      toast.error('Failed to load next task');
    }
  };

  // Fetch relevant community goal for the current task
  const fetchRelevantGoal = async (task: FlowTask) => {
    try {
      // Get all active community goals
      const goals = await backendApi.get<ApiCommunityGoal[]>('/community-goals');
      
      if (!goals || goals.length === 0) {
        setRelevantGoal(null);
        return;
      }

      // Determine the language being translated
      const taskLanguage = selectedLanguage || task.task?.language;
      const taskSourceId = task.task?.source_id;

      // Find the most relevant goal
      // Priority: 1) Collection goal for this source, 2) Translation count goal for this language
      let matchedGoal: ApiCommunityGoal | null = null;

      // First, try to match collection goal
      if (taskSourceId) {
        matchedGoal = goals.find(
          g => g.goal_type === 'collection' && 
               g.collection_id === taskSourceId &&
               g.is_active === 1 &&
               (!g.target_language || g.target_language === taskLanguage)
        ) || null;
      }

      // If no collection goal, try translation_count goal
      if (!matchedGoal && taskLanguage) {
        matchedGoal = goals.find(
          g => g.goal_type === 'translation_count' &&
               g.is_active === 1 &&
               (!g.target_language || g.target_language === taskLanguage)
        ) || null;
      }

      if (matchedGoal) {
        // Fetch progress for the matched goal
        const progress = await backendApi.get<ApiCommunityGoalProgress>(`/community-goals/${matchedGoal.id}/progress`);
        setRelevantGoal({ goal: matchedGoal, progress });
      } else {
        setRelevantGoal(null);
      }
    } catch (error) {
      console.error('Failed to fetch relevant goal:', error);
      setRelevantGoal(null);
    }
  };

  // Refresh daily goal
  const refreshDailyGoal = async () => {
    try {
      const response = await getFlowStats();
      setDailyGoal(response.dailyGoal);
    } catch (error) {
      console.error('Failed to refresh daily goal:', error);
    }
  };

  // Handle review submission
  const handleSubmitReview = async (action: 'approve' | 'reject' | 'discuss', rejectionReason?: string, discussionMessage?: string, discussionTranslation?: string) => {
    if (!currentTask?.task?.translation_id || !sessionId) return;

    try {
      setIsSubmitting(true);
      const result = await submitReview(
        currentTask.task.translation_id,
        action,
        sessionId,
        rejectionReason,
        discussionMessage,
        discussionTranslation
      );

      // For discussion, don't update stats but show success message
      if (action === 'discuss') {
        toast.success('Discussion message posted successfully');
        // Stay on current translation - the FlowTermCard will reload history automatically
        // when it detects a change (we don't need to manually reload here)
      } else {
        // Update session stats for approve/reject
        setSessionPoints((prev) => prev + result.points);
        setSessionReviews((prev) => prev + 1);

        // Show celebration for new streak
        if (result.streakInfo.isNewStreak && result.streakInfo.streak > 1) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
        }

        // Update stats
        if (stats) {
          setStats({
            ...stats,
            points: stats.points + result.points,
            daily_streak: result.streakInfo.streak,
            longest_streak: result.streakInfo.longestStreak,
            reviews_count: stats.reviews_count + 1,
          });
        }

        toast.success(
          action === 'approve'
            ? `Translation approved! +${result.points} reputation`
            : `Translation rejected. +${result.points} reputation`
        );

        // Refresh daily goal
        await refreshDailyGoal();

        // Load next task
        await loadNextTask();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle translation submission
  const handleSubmitTranslation = async (language: string, value: string, resubmissionMotivation?: string) => {
    if (!currentTask?.task || !sessionId || !user) return;

    const task = currentTask.task;

    try {
      setIsSubmitting(true);

      // Fetch the full term data by ID to get all existing translations
      const fullTerm = await backendApi.getTerm(task.term_id);

      if (!fullTerm) {
        throw new Error('Term not found');
      }

      // Build the term structure for PUT /api/terms/:id
      // We need to preserve ALL existing translations and add/update the new one
      const termData = {
        uri: fullTerm.uri,
        fields: fullTerm.fields.map((field: any) => {
          // Start with all existing translations for this field
          let translationsPayload = field.translations ? [...field.translations].map((t: any) => ({
            language: t.language,
            value: t.value,
            status: t.status,
            created_by: t.created_by || user.username,
          })) : [];
          
          // If this is the field we're translating, add or update the translation
          if (field.field_uri === task.field_uri) {
            const existingIndex = translationsPayload.findIndex((t: any) => t.language === language);
            
            if (existingIndex >= 0) {
              // Update existing translation
              translationsPayload[existingIndex] = {
                language,
                value,
                status: 'review',
                created_by: translationsPayload[existingIndex].created_by,
                ...(resubmissionMotivation ? { resubmission_motivation: resubmissionMotivation } : {}),
              };
            } else {
              // Add new translation
              translationsPayload.push({
                language,
                value,
                status: 'review',
                created_by: user.username,
                ...(resubmissionMotivation ? { resubmission_motivation: resubmissionMotivation } : {}),
              });
            }
          }
          
          return {
            field_uri: field.field_uri,
            field_term: field.field_term,
            original_value: field.original_value,
            translations: translationsPayload,
          };
        }),
        token: user.token,
        username: user.username,
      };

      // Submit using the existing PUT /api/terms/:id endpoint
      await backendApi.updateTerm(task.term_id, termData);

      // Update session stats manually (1 point for translation)
      setSessionPoints((prev) => prev + 1);
      setSessionTranslations((prev) => prev + 1);

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          translations_count: stats.translations_count + 1,
        });
      }

      toast.success('Translation submitted! +1 reputation');

      // Refresh daily goal
      await refreshDailyGoal();

      // Load next task
      await loadNextTask();
    } catch (error) {
      console.error('Failed to submit translation:', error);
      toast.error('Failed to submit translation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle end session
  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      await endFlowSession(sessionId);
      toast.success(`Session ended! You earned ${sessionPoints} points.`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
    }
  };

  // Handle skip task
  const handleSkipTask = async () => {
    if (!currentTask?.task) return;

    try {
      setIsSubmitting(true);

      // Log the skip action
      await skipTask({
        taskType: currentTask.type,
        termId: currentTask.task.term_id,
        translationId: currentTask.task.translation_id,
        fieldUri: currentTask.task.field_uri,
        language: currentTask.task.language,
      });

      toast.success('Task skipped');

      // Load next task
      await loadNextTask();
    } catch (error) {
      console.error('Failed to skip task:', error);
      toast.error('Failed to skip task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading Translation Flow...</p>
        </div>
      </div>
    );
  }

  if (!currentTask || currentTask.type === 'none') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-12">
              <Sparkles className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                All Caught Up! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {currentTask?.message || 'No more tasks available right now. Great work!'}
              </p>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  Session Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {sessionPoints}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Points</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {sessionTranslations}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Translations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {sessionReviews}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Reviews</div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleEndSession}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                <Home className="w-5 h-5" />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Celebration Effect */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">🔥</div>
        </div>
      )}

      <div className="container mx-auto px-0 md:px-4 py-0 md:py-8">
        {/* Header - hidden on phone */}
        <div className="hidden md:flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              Translation Flow
              {selectedLanguage && (
                <span className="text-sm font-semibold px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  {languages.find(l => l.code === selectedLanguage)?.name || selectedLanguage.toUpperCase()}
                </span>
              )}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Complete tasks to earn points and maintain your streak!
            </p>
          </div>
          <button
            onClick={handleEndSession}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            End Session
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 md:gap-8">
          {/* Main Task Area */}
          <div className="lg:col-span-2">
            <FlowTermCard
              task={currentTask.task}
              taskType={currentTask.type as 'review' | 'translate' | 'rework' | 'discussion'}
              languages={
                selectedLanguage && (currentTask.type === 'translate' || currentTask.type === 'rework')
                  ? languages.filter(lang => lang.code === selectedLanguage)
                  : languages
              }
              onSubmitReview={handleSubmitReview}
              onSubmitTranslation={handleSubmitTranslation}
              onSkipTask={handleSkipTask}
              isSubmitting={isSubmitting}
              relevantGoal={relevantGoal}
              linkedNotification={linkedNotification}
            />
          </div>

          {/* Stats Sidebar - hidden on phone */}
          <div className="hidden lg:block lg:col-span-1">
            <FlowStatsPanel
              stats={stats}
              challenges={challenges}
              dailyGoal={dailyGoal}
              sessionPoints={sessionPoints}
              sessionTranslations={sessionTranslations}
              sessionReviews={sessionReviews}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationFlow;