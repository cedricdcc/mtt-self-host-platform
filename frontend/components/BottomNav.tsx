import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Target, Fish } from 'lucide-react';
import { backendApi } from '../services/api';
import { ApiCommunityGoal, ApiCommunityGoalProgress } from '../types';
import NotificationBell from './NotificationBell';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const [pendingGoalsCount, setPendingGoalsCount] = useState<number>(0);

  useEffect(() => {
    const fetchPendingGoalsCount = async () => {
      try {
        const goals = await backendApi.get<ApiCommunityGoal[]>('/community-goals');
        const activeGoals = goals.filter(g => g.is_active === 1);

        // Fetch progress for each goal to count incomplete ones
        let pendingCount = 0;
        await Promise.all(
          activeGoals.map(async (goal) => {
            try {
              const progress = await backendApi.get<ApiCommunityGoalProgress>(`/community-goals/${goal.id}/progress`);
              if (!progress.is_complete) {
                pendingCount++;
              }
            } catch (error) {
              // If we can't fetch progress, assume it's incomplete
              pendingCount++;
            }
          })
        );
        setPendingGoalsCount(pendingCount);
      } catch (error) {
        console.error('Failed to fetch pending goals count:', error);
      }
    };

    fetchPendingGoalsCount();
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      path: '/dashboard',
      icon: Home,
      label: 'Home',
    },
    {
      path: '/oceanarium',
      icon: Fish,
      label: 'Codex',
    },
    {
      path: '/leaderboard',
      icon: TrendingUp,
      label: 'Leaderboard',
    },
    {
      path: '/community-goals',
      icon: Target,
      label: 'Goals',
    },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const isGoals = item.path === '/community-goals';
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                  active
                    ? 'text-marine-600 dark:text-marine-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-marine-600 dark:hover:text-marine-400'
                }`}
              >
                <div className="relative">
                  <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                  {isGoals && pendingGoalsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingGoalsCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Notifications & Invitations Bell - Mobile optimized */}
          <div className="relative flex flex-col items-center justify-center flex-1 h-full">
            <NotificationBell isMobile={true} />
          </div>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
