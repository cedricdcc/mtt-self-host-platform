import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { EventTimelinePoint } from '../types';

interface EventActivityChartProps {
  data: EventTimelinePoint[];
  resolution: 'hour' | 'day' | 'week';
  selectedResolution: string;
  onResolutionChange: (res: string) => void;
}

export const EventActivityChart: React.FC<EventActivityChartProps> = ({
  data,
  resolution,
  selectedResolution,
  onResolutionChange
}) => {
  const resolutions = [
    { id: 'smart', label: `Auto (${resolution})` },
    { id: 'hour', label: 'Hourly' },
    { id: 'day', label: 'Daily' },
    { id: 'week', label: 'Weekly' }
  ];

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Over Time</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Work completed since competition started (In Review vs Approved)
          </p>
        </div>

        {/* Resolution selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
          {resolutions.map((r) => (
            <button
              key={r.id}
              onClick={() => onResolutionChange(r.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                selectedResolution === r.id
                  ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-400 text-sm">
          No contribution activity recorded yet for this timeframe.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => {
                  if (resolution === 'hour') return val.split(' ')[1] || val;
                  if (resolution === 'day') return val.slice(5);
                  return val;
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null;
                  const inRev = payload.find((p: any) => p.dataKey === 'inReview')?.value || 0;
                  const app = payload.find((p: any) => p.dataKey === 'approved')?.value || 0;
                  const tot = Number(inRev) + Number(app);
                  return (
                    <div className="bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl p-3 text-xs space-y-1">
                      <div className="font-semibold text-slate-300 mb-1">{label}</div>
                      <div className="flex items-center justify-between gap-4 text-amber-400">
                        <span>📝 In Review:</span>
                        <span className="font-bold">{inRev}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>✅ Approved:</span>
                        <span className="font-bold">{app}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-4 text-white font-bold">
                        <span>Total Actions:</span>
                        <span>{tot}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(val) => (
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {val === 'inReview' ? 'In Review' : 'Approved'}
                  </span>
                )}
              />
              <Bar dataKey="inReview" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="inReview" />
              <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="approved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
