
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Users, Database, AlertTriangle, TrendingUp, Activity, PieChart, DownloadCloud, Layers, Target, Mail } from 'lucide-react';
import { backendApi } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ContributionData {
  date: string;
  byStatus: Record<string, number>;
  total: number;
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
  const [historyGraphData, setHistoryGraphData] = useState<ContributionData[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('last_14_days');

  const fetchContributionsOverTime = React.useCallback(async (timeframe: string) => {
    try {
      console.log('Fetching contributions for timeframe:', timeframe);
      const data = await backendApi.get<{ timeframe: string; data: ContributionData[] }>(
        '/stats/contributions-over-time',
        { timeframe }
      );
      console.log('Received contributions data:', data);
      setHistoryGraphData(data.data);
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

  // --- Helpers for SVG Charts ---

  // Simple Bar Chart for Status
  const renderStatusBars = () => {
     // Fix: Cast Object.values to number[] to handle TS 'unknown' inference
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
    // Handle both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DD HH:MM:SS) formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // If parsing fails, return the first part before 'T' or space
      return dateStr.split(/[T ]/)[0];
    }
    
    // Check if it includes time (hourly grouping)
    if (dateStr.includes(':')) {
      // Format as "MM-DD HH:mm"
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    } else {
      // Format as "MM-DD" for daily grouping
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    }
  };

  // Line Graph for Contributions Over Time
  const renderLineGraph = () => {
      if (historyGraphData.length === 0) {
        return <div className="text-center text-slate-400 text-sm py-8">No data available for this timeframe</div>;
      }

      const statusOrder = ['draft', 'review', 'approved', 'merged', 'rejected'];
      const colors: Record<string, string> = {
          merged: '#a855f7',      // purple-500
          approved: '#22c55e',    // green-500
          review: '#f59e0b',      // amber-500
          draft: '#94a3b8',       // slate-400
          rejected: '#ef4444',    // red-500
          total: '#3b82f6'        // blue-500
      };
      
      // Find max total for scaling
      const maxTotal = Math.max(...historyGraphData.map(d => d.total), 1);
      
      // Calculate Y-axis labels (5 evenly spaced values from 0 to maxTotal)
      const yAxisSteps = 5;
      const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) => {
        return Math.round((maxTotal / (yAxisSteps - 1)) * (yAxisSteps - 1 - i));
      });
      
      // Chart dimensions
      const chartHeight = 320; // h-80 in pixels
      const chartWidth = 100; // percentage
      
      // Calculate points for each line
      const getYPosition = (value: number) => {
        return ((maxTotal - value) / maxTotal) * 100; // Inverted for SVG coordinates
      };
      
      const getXPosition = (index: number) => {
        return (index / (historyGraphData.length - 1)) * 100;
      };
      
      // Generate SVG path for a line
      const generatePath = (dataKey: 'total' | keyof ContributionData['byStatus']) => {
        const points = historyGraphData.map((d, i) => {
          const value = dataKey === 'total' ? d.total : (d.byStatus[dataKey] || 0);
          const x = getXPosition(i);
          const y = getYPosition(value);
          return `${x},${y}`;
        });
        
        // Create smooth curve using quadratic bezier
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0]}`;
        
        let path = `M ${points[0]}`;
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i]}`;
        }
        return path;
      };
      
      return (
        <div className="relative">
          <div className="flex gap-3">
            {/* Y-axis */}
            <div className="flex flex-col justify-between h-80 py-1 text-xs text-slate-400 w-8 text-right">
              {yAxisLabels.map((label, idx) => (
                <div key={idx} className="leading-none">{label}</div>
              ))}
            </div>
            
            {/* Chart area */}
            <div className="flex-1 relative">
              {/* Horizontal gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {yAxisLabels.map((_, idx) => (
                  <div key={idx} className="border-t border-slate-200 dark:border-slate-700/50"></div>
                ))}
              </div>
              
              {/* SVG Line Graph */}
              <div className="relative h-80">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Draw lines for each status */}
                  {statusOrder.map(status => {
                    const hasData = historyGraphData.some(d => (d.byStatus[status] || 0) > 0);
                    if (!hasData) return null;
                    
                    return (
                      <path
                        key={status}
                        d={generatePath(status)}
                        fill="none"
                        stroke={colors[status]}
                        strokeWidth="0.5"
                        className="transition-all"
                        opacity="0.7"
                      />
                    );
                  })}
                  
                  {/* Draw total line (thicker and more prominent) */}
                  <path
                    d={generatePath('total')}
                    fill="none"
                    stroke={colors.total}
                    strokeWidth="1"
                    className="transition-all"
                  />
                </svg>
                
                {/* Data point markers */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {historyGraphData.map((dataPoint, idx) => {
                    const x = getXPosition(idx);
                    
                    return (
                      <g key={idx}>
                        {/* Status points */}
                        {statusOrder.map(status => {
                          const value = dataPoint.byStatus[status] || 0;
                          if (value === 0) return null;
                          const y = getYPosition(value);
                          
                          return (
                            <circle
                              key={status}
                              cx={x}
                              cy={y}
                              r="0.8"
                              fill={colors[status]}
                              className="transition-all hover:r-1.5"
                            />
                          );
                        })}
                        
                        {/* Total point */}
                        <circle
                          cx={x}
                          cy={getYPosition(dataPoint.total)}
                          r="1.2"
                          fill={colors.total}
                          className="transition-all"
                        />
                      </g>
                    );
                  })}
                </svg>
                
                {/* Interactive overlay for tooltips */}
                <div className="absolute inset-0 flex">
                  {historyGraphData.map((dataPoint, idx) => (
                    <div
                      key={idx}
                      className="flex-1 group relative cursor-pointer"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap shadow-lg">
                          <div className="font-semibold mb-1">{formatDateLabel(dataPoint.date)}</div>
                          <div className="flex items-center gap-2 font-bold text-blue-400 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>Total: {dataPoint.total}</span>
                          </div>
                          {statusOrder.map(status => {
                            const count = dataPoint.byStatus[status] || 0;
                            if (count === 0) return null;
                            return (
                              <div key={status} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[status] }}></div>
                                <span className="capitalize">{status}: {count}</span>
                              </div>
                            );
                          })}
                          {/* Arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                      
                      {/* Vertical line on hover */}
                      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300 dark:bg-slate-600 opacity-0 group-hover:opacity-50 transition-opacity"></div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* X-axis labels */}
              <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
                {historyGraphData.map((d, idx) => (
                  <div key={idx} className="flex-1 text-center">
                    <span className="truncate block">{formatDateLabel(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 justify-center mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded-sm bg-blue-500"></div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Total</span>
            </div>
            {statusOrder.map(status => (
              <div key={status} className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded-sm" style={{ backgroundColor: colors[status] }}></div>
                <span className="capitalize text-slate-600 dark:text-slate-300">{status}</span>
              </div>
            ))}
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
