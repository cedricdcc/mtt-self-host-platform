
import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Database, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  PieChart, 
  Layers, 
  Target, 
  Mail, 
  Award,
  Zap,
  Calendar,
  Fish
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { backendApi } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ActivityDataPoint {
  date: string;
  total_actions: number;
  active_users: number;
  translations: number;
  reviews: number;
  discussions: number;
}

interface ActivitySummary {
  totalActions: number;
  totalUniqueUsers: number;
  peakDate: string;
  peakActions: number;
}

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    userCount: 0,
    termCount: 0,
    translationCount: 0,
    openAppeals: 0,
  });
  const [statusDist, setStatusDist] = useState<Record<string, number>>({});
  const [historyGraphData, setHistoryGraphData] = useState<ActivityDataPoint[]>([]);
  const [summaryStats, setSummaryStats] = useState<ActivitySummary>({
    totalActions: 0,
    totalUniqueUsers: 0,
    peakDate: 'N/A',
    peakActions: 0,
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('last_14_days');

  const fetchContributionsOverTime = React.useCallback(async (timeframe: string) => {
    try {
      console.log('Fetching contributions for timeframe:', timeframe);
      const data = await backendApi.get<{ 
        timeframe: string; 
        summary: ActivitySummary;
        data: ActivityDataPoint[] 
      }>(
        '/stats/contributions-over-time',
        { timeframe }
      );
      console.log('Received contributions data:', data);
      setHistoryGraphData(data.data || []);
      if (data.summary) {
        setSummaryStats(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch contributions over time", error);
      toast.error("Failed to load contribution history");
    }
  }, []);

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const [users, statsData, appeals] = await Promise.all([
           backendApi.getUsers(),
           backendApi.getStats(),
           backendApi.getAppeals()
        ]);

        // 1. Counts
        const openAppeals = appeals.filter(a => a.status === 'open').length;
        
        // 2. Status Distribution from stats endpoint (already excludes 'original')
        const dist = statsData.byStatus || { merged: 0, approved: 0, review: 0, draft: 0, rejected: 0 };

        setStats({
            userCount: users.length,
            termCount: statsData.totalTerms,
            translationCount: statsData.totalTranslations,
            openAppeals
        });
        setStatusDist(dist);
        
        // 3. Fetch contributions over time
        await fetchContributionsOverTime(selectedTimeframe);

      } catch (error) {
        console.error("Admin fetch error", error);
        toast.error("Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [selectedTimeframe, fetchContributionsOverTime]);

  // Simple Bar Chart for Status
  const renderStatusBars = () => {
     const values = Object.values(statusDist) as number[];
     const max = Math.max(...values, 1);
     const colors: Record<string, string> = {
         merged: 'bg-purple-500', approved: 'bg-green-500', review: 'bg-amber-500', draft: 'bg-slate-400', rejected: 'bg-red-500'
     };
     
     return Object.keys(statusDist).map(key => {
         const val = statusDist[key];
         const pct = (val / max) * 100;
         return (
             <div key={key} className="mb-3 last:mb-0">
                 <div className="flex justify-between text-xs mb-1">
                     <span className="capitalize text-slate-600 dark:text-slate-300 font-medium">{key}</span>
                     <span className="text-slate-500">{val}</span>
                 </div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                     <div className={`h-2 rounded-full ${colors[key]}`} style={{ width: `${pct}%` }}></div>
                 </div>
             </div>
         );
     });
  };

  // Helper function to format date labels
  const formatDateLabel = (dateStr: string): string => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr.split(/[T ]/)[0];
    }
    
    if (dateStr.includes(':')) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    }
  };

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: ActivityDataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs min-w-[210px]">
          <div className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1.5 mb-2 flex items-center justify-between">
            <span>{formatDateLabel(data.date)}</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
              {data.date.includes(':') ? 'Hourly' : 'Daily'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Total Actions:
              </span>
              <span className="font-bold text-white text-sm">{data.total_actions}</span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Active Contributors:
              </span>
              <span className="font-bold text-white text-sm">{data.active_users}</span>
            </div>
            <div className="pt-2 mt-1 border-t border-slate-800 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="bg-slate-800/80 rounded p-1">
                <div className="text-sky-400 font-bold">{data.translations}</div>
                <div className="text-slate-400 text-[9px]">Translate</div>
              </div>
              <div className="bg-slate-800/80 rounded p-1">
                <div className="text-emerald-400 font-bold">{data.reviews}</div>
                <div className="text-slate-400 text-[9px]">Review</div>
              </div>
              <div className="bg-slate-800/80 rounded p-1">
                <div className="text-amber-400 font-bold">{data.discussions}</div>
                <div className="text-slate-400 text-[9px]">Discuss</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Recharts Graph for Contributions Over Time
  const renderLineGraph = () => {
    if (historyGraphData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
          <Activity size={32} className="mb-2 opacity-40" />
          <p>No activity recorded for this timeframe</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* KPI Mini Badges */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <Zap size={16} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Actions</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{summaryStats.totalActions}</p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Active Users</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{summaryStats.totalUniqueUsers}</p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Peak Day</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {formatDateLabel(summaryStats.peakDate)} ({summaryStats.peakActions})
              </p>
            </div>
          </div>
        </div>

        {/* Recharts Composed Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historyGraphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDateLabel}
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: '#334155', opacity: 0.3 }}
              />
              <YAxis 
                yAxisId="actions"
                stroke="#06b6d4" 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis 
                yAxisId="users"
                orientation="right"
                stroke="#818cf8" 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top"
                height={32}
                iconType="circle"
                formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-300 mr-2">{value}</span>}
              />
              <Area 
                yAxisId="actions" 
                type="monotone" 
                dataKey="total_actions" 
                name="Daily Actions" 
                stroke="#06b6d4" 
                strokeWidth={2.5} 
                fill="url(#actionsGradient)" 
              />
              <Line 
                yAxisId="users" 
                type="monotone" 
                dataKey="active_users" 
                name="Active Contributors" 
                stroke="#818cf8" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }} 
                activeDot={{ r: 6, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div className="p-3 bg-slate-900 text-white rounded-lg">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">System overview and management portal.</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                        {loading ? '...' : stats.userCount}
                    </h3>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                    <Users size={20} />
                </div>
            </div>
            <Link to="/admin/users" className="text-xs font-medium text-blue-600 hover:text-blue-700">Manage Users &rarr;</Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Translations</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                        {loading ? '...' : stats.translationCount}
                    </h3>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                    <Database size={20} />
                </div>
            </div>
            <Link to="/admin/translations" className="text-xs font-medium text-green-600 hover:text-green-700">Manage Translations &rarr;</Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Appeals</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                        {loading ? '...' : stats.openAppeals}
                    </h3>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                    <AlertTriangle size={20} />
                </div>
            </div>
            <Link to="/admin/moderation" className="text-xs font-medium text-amber-600 hover:text-amber-700">Review Items &rarr;</Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Admin Activity</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        Activity Log
                    </h3>
                </div>
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 rounded-lg">
                    <Activity size={20} />
                </div>
            </div>
            <Link to="/admin/activity" className="text-xs font-medium text-cyan-600 hover:text-cyan-700">View Activity &rarr;</Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">KPI's</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        Analytics
                    </h3>
                </div>
                <div className="p-2 bg-marine-100 dark:bg-marine-900/30 text-marine-600 rounded-lg">
                    <TrendingUp size={20} />
                </div>
            </div>
            <Link to="/admin/kpi" className="text-xs font-medium text-marine-600 hover:text-marine-700">View KPI's &rarr;</Link>
        </div>
      </div>

      {/* Management Panels */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers size={20} className="text-teal-600" />
                        Data Sources
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        View and manage all data sources (LDES feeds, static files, SPARQL)
                    </p>
                </div>
            </div>
            <Link to="/admin/sources" className="inline-block px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
                View Sources &rarr;
            </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Target size={20} className="text-blue-600" />
                        Community Goals
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Create and manage community-wide translation goals and challenges
                    </p>
                </div>
            </div>
            <Link to="/admin/community-goals" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                Manage Goals &rarr;
            </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-purple-600" />
                        Communities
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Manage user communities, review reports, and delete inappropriate communities
                    </p>
                </div>
            </div>
            <Link to="/admin/communities" className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
                Manage Communities &rarr;
            </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity size={20} className="text-indigo-600" />
                        Background Tasks
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Monitor long-running tasks and manage task schedulers for automation
                    </p>
                </div>
            </div>
            <Link to="/admin/tasks" className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                View Tasks &rarr;
            </Link>
        </div>

        {/* Reputation Rules Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <ShieldCheck className="text-yellow-600 dark:text-yellow-400" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                            Reputation Rules
                        </h3>
                    </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Configure reputation system parameters and preview impact of rule changes
                </p>
            </div>
            <Link to="/admin/reputation-rules" className="inline-block px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors mt-4">
                Manage Rules &rarr;
            </Link>
        </div>

        {/* Mailing Service Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                        <Mail className="text-cyan-600 dark:text-cyan-400" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                            Mailing Service
                        </h3>
                    </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Monitor outgoing email queue, retry failed deliveries, and send system announcements.
                </p>
            </div>
            <Link to="/admin/mail" className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors mt-4">
                Manage Mail &rarr;
            </Link>
        </div>

        {/* Achievements Config Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                        <Award className="text-rose-600 dark:text-rose-400" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                            Achievements Config
                        </h3>
                    </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Configure target thresholds and reward points for marine creature achievement tiers.
                </p>
            </div>
            <Link to="/admin/achievements" className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors mt-4">
                Manage Achievements &rarr;
            </Link>
        </div>

        {/* Events & Competitions Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Target className="text-emerald-600 dark:text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                            Events & Competitions
                        </h3>
                    </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Create time-bound challenges, configure target categories, manage competing teams, and award custom titles.
                </p>
            </div>
            <Link to="/admin/events" className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors mt-4">
                Manage Events &rarr;
            </Link>
        </div>

        {/* Oceanarium & Gacha Management */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:border-cyan-500/50 transition-all">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
                        <Fish size={24}/>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        Preview
                    </span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    Oceanarium & Gacha
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage user preview access, distribute dive tickets, and inspect marine ecosystem status.
                </p>
            </div>
            <Link to="/admin/gacha" className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors mt-4">
                Manage Ecosystem &rarr;
            </Link>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="grid md:grid-cols-3 gap-6">
          {/* Status Distribution */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                  <PieChart size={18} className="text-marine-500"/> Status Distribution
              </h3>
              {loading ? <div className="animate-pulse h-32 bg-slate-100 rounded"></div> : renderStatusBars()}
          </div>

          {/* Timeline Graph */}
          <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={18} className="text-marine-500"/> Contributions Over Time
                  </h3>
                  <select 
                    className="text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-marine-500"
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                  >
                      <option value="last_hour">Last Hour</option>
                      <option value="last_24_hours">Last 24 Hours</option>
                      <option value="last_week">Last Week</option>
                      <option value="last_14_days">Last 14 Days</option>
                      <option value="last_month">Last Month</option>
                      <option value="all_time">All Time</option>
                  </select>
              </div>
              
              <div className="w-full">
                  {loading ? <div className="animate-pulse h-48 bg-slate-100 rounded"></div> : renderLineGraph()}
              </div>
          </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
