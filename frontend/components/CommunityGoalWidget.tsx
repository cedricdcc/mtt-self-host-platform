
import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Target, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { backendApi } from '../services/api';
import { ApiCommunityGoal, ApiCommunityGoalProgress } from '../types';
import toast from 'react-hot-toast';
import SplineScene from './SplineScene';

interface CommunityGoalWidgetProps {
  onDismiss?: () => void;
  className?: string;
}

const CommunityGoalWidget: React.FC<CommunityGoalWidgetProps> = ({ onDismiss, className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [goals, setGoals] = useState<ApiCommunityGoal[]>([]);
  const [progress, setProgress] = useState<Record<number, ApiCommunityGoalProgress>>({});
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(() => {
    // Load minimized state from localStorage
    const saved = localStorage.getItem('communityGoalsMinimized');
    return saved === 'true';
  });
  const [showBubble, setShowBubble] = useState(false);

  const [splineApp, setSplineApp] = useState<any>(null);
  const [fishObject, setFishObject] = useState<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const [isHovered, setIsHovered] = useState(false);
  const mouseRef = React.useRef({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const posRef = React.useRef({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const [pageDelayPassed, setPageDelayPassed] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const mouseMoveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastMovedRef = React.useRef(Date.now());
  const eyeballsRef = React.useRef<any[]>([]);
  const pupilsRef = React.useRef<any[]>([]);
  const finsRef = React.useRef<any[]>([]);
  const rawMouseRef = React.useRef({ x: window.innerWidth - 100, y: window.innerHeight - 100 });

  const handleSplineLoad = (app: any) => {
    setSplineApp(app);
    try {
      const allObjects = app.getAllObjects();

      // Send object details to the backend log
      const objectsData = allObjects.map((o: any) => ({
        name: o.name,
        type: o.type,
        id: o.id,
        position: o.position ? { x: o.position.x, y: o.position.y, z: o.position.z } : null,
        rotation: o.rotation ? { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z } : null
      }));

      fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objects: objectsData })
      }).catch(err => console.error('Failed to post debug-log:', err));

      console.log('[Spline Pufferfish] All objects in scene:', allObjects.map((o: any) => o.name));

      // Look for the main fish or puffer or group
      const foundFish = allObjects.find((o: any) =>
        o.name.toLowerCase().includes('fish') ||
        o.name.toLowerCase().includes('puffer') ||
        o.name.toLowerCase().includes('character') ||
        o.name === 'Group' ||
        o.name === 'group'
      );

      if (foundFish) {
        console.log('[Spline Pufferfish] Found fish object:', foundFish.name);
        setFishObject(foundFish);
      } else if (allObjects.length > 0) {
        const fallback = allObjects.find((o: any) => o.type === 'group') || allObjects[0];
        console.log('[Spline Pufferfish] Using fallback object:', fallback.name);
        setFishObject(fallback);
      }

      // Filter eyeballs and pupils to prevent coordinate distortion
      const eyeballObjects = allObjects.filter((o: any) =>
        o.name.toLowerCase().includes('eye') &&
        !o.name.toLowerCase().includes('pupil') &&
        !o.name.toLowerCase().includes('iris')
      );
      const pupilObjects = allObjects.filter((o: any) =>
        o.name.toLowerCase().includes('pupil') ||
        o.name.toLowerCase().includes('iris')
      );

      // Save eyeballs
      eyeballsRef.current = eyeballObjects.map((eye: any) => ({
        obj: eye,
        defaultRotation: { x: eye.rotation.x, y: eye.rotation.y, z: eye.rotation.z }
      }));

      // If we have separate pupils, map them. Otherwise, let eyeballs act as the tracking pupils.
      if (pupilObjects.length > 0) {
        console.log('[Spline Pufferfish] Found separate pupil objects:', pupilObjects.map((o: any) => o.name));
        pupilsRef.current = pupilObjects.map((p: any) => ({
          obj: p,
          defaultRotation: { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z }
        }));
      } else {
        console.log('[Spline Pufferfish] No separate pupils found, using eyeballs as pupils.');
        pupilsRef.current = eyeballObjects.map((eye: any) => ({
          obj: eye,
          defaultRotation: { x: eye.rotation.x, y: eye.rotation.y, z: eye.rotation.z }
        }));
        eyeballsRef.current = []; // Clear eyeballs so we don't double-process
      }

      // Look for fin objects and store their initial rotations
      const foundFins = allObjects.filter((o: any) =>
        o.name.toLowerCase().includes('fin')
      );
      console.log('[Spline Pufferfish] Found fin objects:', foundFins.map((o: any) => o.name));
      finsRef.current = foundFins.map((fin: any) => ({
        obj: fin,
        defaultRotation: { x: fin.rotation.x, y: fin.rotation.y, z: fin.rotation.z }
      }));
    } catch (err) {
      console.error('[Spline Pufferfish] Error searching objects:', err);
    }
  };

  // Manage page delay on navigation (must be on page for > 2s to follow)
  useEffect(() => {
    setPageDelayPassed(false);
    const timer = setTimeout(() => {
      setPageDelayPassed(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Track mouse coordinates globally and detect mouse idle state (300ms delay)
  useEffect(() => {
    const isTranslationPage = location.pathname.startsWith('/flow') || location.pathname.includes('/term/') || location.pathname.includes('/admin');
    if (!isMinimized || isTranslationPage) return;

    const handleMouseMove = (e: MouseEvent) => {
      rawMouseRef.current = {
        x: e.clientX,
        y: e.clientY
      };
      // Offset target position to prevent the fish from thinking the cursor is hovering over it (which causes puff animation), while still letting eyes follow the cursor
      mouseRef.current = {
        x: e.clientX + 30,
        y: e.clientY + 30
      };

      // Mouse is moving, so update the timestamp
      lastMovedRef.current = Date.now();
      setIsMouseIdle(false);

      // Reset the idle timeout
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setIsMouseIdle(true);
      }, 200);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
    };
  }, [isMinimized, location.pathname]);

  // Animation loop for smooth lagging trailing
  useEffect(() => {
    const isTranslationPage = location.pathname.startsWith('/flow') || location.pathname.includes('/term/');
    if (!isMinimized || isTranslationPage) return;

    let animationFrameId: number;

    const updatePosition = () => {
      const targetX = mouseRef.current.x;
      const targetY = mouseRef.current.y;

      const dx = targetX - posRef.current.x;
      const dy = targetY - posRef.current.y;

      // Always follow physical position removed to make widget stationary
      // posRef.current.x += dx * speedFactor;
      // posRef.current.y += dy * speedFactor;
      // setPosition({ x: clampedX, y: clampedY });


      // Check proximity (distance between actual cursor and pufferfish)
      const rawDx = rawMouseRef.current.x - posRef.current.x;
      const rawDy = rawMouseRef.current.y - posRef.current.y;
      const distance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const isClose = distance < 120; // threshold for being close/hovering on the fish

      if (fishObject) {
        if (isClose) {
          // Stop body rotation when close (override manual tilt and built-in hover rotation)
          fishObject.rotation.y += (0 - fishObject.rotation.y) * 0.2;
          fishObject.rotation.x += (0 - fishObject.rotation.x) * 0.2;
        } else {
          // 2.5D isometric body rotation towards the cursor (moderate bounds to prevent eye shifting)
          const targetYaw = -Math.max(-0.18, Math.min(0.18, dx * 0.003));
          const targetPitch = Math.max(-0.09, Math.min(0.09, dy * 0.003));
          fishObject.rotation.y += (targetYaw - fishObject.rotation.y) * 0.15;
          fishObject.rotation.x += (targetPitch - fishObject.rotation.x) * 0.15;
        }
      }

      // Rotate fins and eyes in unison with the body rotation, with stabilization for eyeballs/pupils
      const bodyRotY = fishObject ? fishObject.rotation.y : 0;
      const bodyRotX = fishObject ? fishObject.rotation.x : 0;

      // Helper function to check if an object is a child of the fishObject
      const isChildOfFish = (obj: any): boolean => {
        if (!fishObject) return false;
        let p = obj.parent;
        while (p) {
          if (p === fishObject) return true;
          p = p.parent;
        }
        return false;
      };

      // Factor to stabilize eye rotation relative to the body (only 30% of body rotation influence)
      const eyeBodyInfluence = 0.3;

      // Keep eyeballs aligned with the body rotation, but with reduced influence (pointing more forward)
      eyeballsRef.current.forEach((item) => {
        if (item.obj && item.obj.rotation) {
          const isChild = isChildOfFish(item.obj);
          const targetEyeYaw = item.defaultRotation.y + (isChild ? -bodyRotY * (1 - eyeBodyInfluence) : bodyRotY * eyeBodyInfluence);
          const targetEyePitch = item.defaultRotation.x + (isChild ? -bodyRotX * (1 - eyeBodyInfluence) : bodyRotX * eyeBodyInfluence);

          item.obj.rotation.y += (targetEyeYaw - item.obj.rotation.y) * 0.2;
          item.obj.rotation.x += (targetEyePitch - item.obj.rotation.x) * 0.2;
        }
      });

      // Keep pupils tracking the mouse dynamically (even when close), but aligned relative to stabilized eyeballs and strictly clamped
      pupilsRef.current.forEach((item) => {
        if (item.obj && item.obj.rotation) {
          const isEyeballParent = eyeballsRef.current.some(eye => eye.obj === item.obj.parent);
          const isChild = isChildOfFish(item.obj);
          
          // Pupils rotate to look towards the mouse, strictly limited to prevent wonkiness
          const maxPupilYaw = 0.03; // reduced from 0.05
          const maxPupilPitch = 0.018; // reduced from 0.03
          const pupilYawOffset = -Math.max(-maxPupilYaw, Math.min(maxPupilYaw, dx * 0.0003));
          const pupilPitchOffset = Math.max(-maxPupilPitch, Math.min(maxPupilPitch, dy * 0.0003));

          let targetPupilYaw = item.defaultRotation.y + pupilYawOffset;
          let targetPupilPitch = item.defaultRotation.x + pupilPitchOffset;

          if (!isEyeballParent) {
            // If the parent is not an eyeball, we must manually account for the body rotation
            targetPupilYaw += (isChild ? -bodyRotY * (1 - eyeBodyInfluence) : bodyRotY * eyeBodyInfluence);
            targetPupilPitch += (isChild ? -bodyRotX * (1 - eyeBodyInfluence) : bodyRotX * eyeBodyInfluence);
          }

          item.obj.rotation.y += (targetPupilYaw - item.obj.rotation.y) * 0.2;
          item.obj.rotation.x += (targetPupilPitch - item.obj.rotation.x) * 0.2;
        }
      });

      // Keep fins aligned with the body rotation
      finsRef.current.forEach((item) => {
        if (item.obj && item.obj.rotation) {
          const isChild = isChildOfFish(item.obj);
          const targetFinYaw = item.defaultRotation.y + (isChild ? 0 : bodyRotY);
          const targetFinPitch = item.defaultRotation.x + (isChild ? 0 : bodyRotX);

          item.obj.rotation.y += (targetFinYaw - item.obj.rotation.y) * 0.2;
          item.obj.rotation.x += (targetFinPitch - item.obj.rotation.x) * 0.2;
        }
      });

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    animationFrameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isMinimized, isHovered, fishObject, location.pathname, pageDelayPassed]);

  // Track window size to keep the stationary center correct for the eye tracking calculations
  useEffect(() => {
    const updateFixedPosition = () => {
      const defaultX = window.innerWidth - 80;
      const defaultY = window.innerHeight - 80;
      posRef.current = { x: defaultX, y: defaultY };
      mouseRef.current = { x: defaultX, y: defaultY };
    };
    updateFixedPosition();
    window.addEventListener('resize', updateFixedPosition);
    return () => window.removeEventListener('resize', updateFixedPosition);
  }, []);

  // Reset fish when expanded or on translation pages
  useEffect(() => {
    const isTranslationPage = location.pathname.startsWith('/flow') || location.pathname.includes('/term/');
    if (fishObject && (isTranslationPage || !isMinimized)) {
      fishObject.position.x = 0;
      fishObject.position.y = 0;
      fishObject.rotation.x = 0;
      fishObject.rotation.y = 0;
    }
  }, [location.pathname, isMinimized, fishObject]);

  // Display timers and page state checks for the wobbly water bubble prompt
  useEffect(() => {
    if (!isMinimized) {
      setShowBubble(false);
      return;
    }

    const dismissed = localStorage.getItem('communityGoalsBubbleDismissed') === 'true';
    if (dismissed) return;

    // Show after 2s delay
    const showTimer = setTimeout(() => {
      setShowBubble(true);
    }, 2000);

    // Hide after 8s of visibility (10s total from mount/minimize)
    const hideTimer = setTimeout(() => {
      setShowBubble(false);
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isMinimized]);

  useEffect(() => {
    fetchGoals();
  }, []);

  // Refetch goals when URL path or hash changes
  useEffect(() => {
    fetchGoals();
  }, [location.pathname, location.hash]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const goalsData = await backendApi.get<ApiCommunityGoal[]>('/community-goals');

      // Filter out dismissed goals
      const activeGoals = goalsData.filter(g => !g.is_dismissed);
      setGoals(activeGoals);

      // Fetch progress for each goal
      const progressData: Record<number, ApiCommunityGoalProgress> = {};
      await Promise.all(
        activeGoals.map(async (goal) => {
          try {
            const prog = await backendApi.get<ApiCommunityGoalProgress>(`/community-goals/${goal.id}/progress`);
            progressData[goal.id] = prog;
          } catch (error) {
            console.error(`Failed to fetch progress for goal ${goal.id}:`, error);
          }
        })
      );
      setProgress(progressData);
    } catch (error) {
      console.error('Failed to fetch community goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('communityGoalsMinimized', String(newState));
    if (!newState) {
      setShowBubble(false);
      localStorage.setItem('communityGoalsBubbleDismissed', 'true');
    }
  };

  const handleGoalClick = (goal: ApiCommunityGoal) => {
    // Navigate to Translation Flow with appropriate filters
    const params = new URLSearchParams();

    if (goal.target_language) {
      params.append('language', goal.target_language);
    }

    if (goal.goal_type === 'collection' && goal.collection_id) {
      params.append('source', goal.collection_id.toString());
    }

    const queryString = params.toString();
    navigate(queryString ? `/flow?${queryString}` : '/flow');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'translation_count':
        return 'Translation Goal';
      case 'collection':
        return 'Collection Goal';
      default:
        return 'Goal';
    }
  };

  const isAdminPage = location.pathname.startsWith('/admin');
  if (isAdminPage) {
    return null;
  }

  if (loading || goals.length === 0) {
    return null;
  }

  // Minimized state - show only an icon
  if (isMinimized) {
    const completedGoals = goals.filter(g => progress[g.id]?.is_complete);
    const pendingGoals = goals.filter(g => !progress[g.id]?.is_complete);
    const completedCount = completedGoals.length;
    const pendingCount = pendingGoals.length;
    const isTranslationPage = location.pathname.startsWith('/flow') || location.pathname.includes('/term/') || location.pathname.includes('/admin');

    return (
      <div
        className={`fixed bottom-6 right-6 z-50 ${className}`}
        style={{
          pointerEvents: 'auto'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <style>{`
          @keyframes bubbleFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          @keyframes liquidWobble {
            0%, 100% { border-radius: 1.5rem 1.5rem 1.5rem 0.25rem; }
            33% { border-radius: 1.6rem 1.4rem 1.5rem 0.25rem; }
            66% { border-radius: 1.4rem 1.6rem 1.45rem 0.25rem; }
          }
          .water-bubble {
            animation: bubbleFloat 4s ease-in-out infinite, liquidWobble 6s ease-in-out infinite;
          }
        `}</style>
        <div className={`relative ${isHovered ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
          {/* Water bubble text prompt */}
          {showBubble && (
            <div 
              className="absolute right-28 bottom-4 w-48 bg-sky-100/95 dark:bg-sky-950/95 border border-sky-200/50 dark:border-sky-800/40 p-3 shadow-[0_8px_32px_rgba(14,165,233,0.15)] text-slate-800 dark:text-slate-100 text-xs z-30 water-bubble pointer-events-auto cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="pr-4 font-medium leading-relaxed">
                Click the fish to see the goals you can complete!
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBubble(false);
                  localStorage.setItem('communityGoalsBubbleDismissed', 'true');
                }}
                className="absolute top-1 right-2 text-sky-500 hover:text-sky-700 font-bold text-sm"
                aria-label="Close guide"
              >
                &times;
              </button>
            </div>
          )}

          {/* Transparent clickable wrapper container */}
          <div
            ref={containerRef}
            onClick={toggleMinimize}
            className="relative w-28 h-28 flex items-center justify-center cursor-pointer z-10"
            role="button"
            aria-label="Show community goals"
          >
            {/* Pulse glow background */}
            <div className="absolute w-20 h-20 bg-gradient-to-tr from-cyan-400/25 to-blue-500/25 rounded-full blur-md animate-pulse z-0" />
            
            {/* Concentric ripple outer ring */}
            <div className="absolute w-16 h-16 rounded-full border border-cyan-400/40 animate-ping opacity-75 z-0" style={{ animationDuration: '3s' }} />

            {/* 3D Spline Scene (Pufferfish) wrapped in a native resolution container to prevent scale-based blurriness */}
            <div 
              className="absolute w-[240px] h-[240px] pointer-events-auto"
              style={{ left: '-64px', top: '-64px' }}
            >
              <SplineScene
                scene="https://prod.spline.design/wwCXhQqYsmd8fJZw/scene.splinecode"
                className="w-full h-full min-h-0"
                minHeight="min-h-0"
                onLoad={handleSplineLoad}
              />
            </div>

            {/* Badge */}
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-30 shadow-md">
                {pendingCount}
              </span>
            )}
            {completedCount > 0 && pendingCount === 0 && (
              <span className="absolute top-1 right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-30 shadow-md">
                {completedCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-50 ${className}`}>
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          <h3 className="font-semibold">Community Goals</h3>
        </div>
        <button
          onClick={toggleMinimize}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors"
          aria-label="Minimize"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {goals.map((goal) => {
          const goalProgress = progress[goal.id];

          return (
            <div
              key={goal.id}
              onClick={() => handleGoalClick(goal)}
              className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                      {getGoalTypeLabel(goal.goal_type)}
                    </span>
                    {goal.target_language && (
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded uppercase">
                        {goal.target_language}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {goal.title}
                  </h4>
                  {goal.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {goal.description}
                    </p>
                  )}
                </div>
              </div>

              {goalProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {goalProgress.current_count} / {goalProgress.target_count || 'No limit'}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {goalProgress.progress_percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${goalProgress.is_complete
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                        }`}
                      style={{ width: `${Math.min(goalProgress.progress_percentage, 100)}%` }}
                    />
                  </div>
                  {goalProgress.missing_translations && Object.keys(goalProgress.missing_translations).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Missing:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(goalProgress.missing_translations).map(([lang, count]) => (
                          <span
                            key={lang}
                            className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded"
                          >
                            {lang.toUpperCase()}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Until {formatDate(goal.end_date || goal.start_date)}</span>
                </div>
                {goal.is_recurring === 1 && goal.recurrence_type && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="capitalize">{goal.recurrence_type}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommunityGoalWidget;
