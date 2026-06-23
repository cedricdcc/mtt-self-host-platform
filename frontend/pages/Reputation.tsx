
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Award, ThumbsUp, ThumbsDown, ShieldAlert, Star, TrendingUp, Shield, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReputationHistoryChart from '../components/ReputationHistoryChart';
import { backendApi } from '../services/api';

const Reputation: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<Record<string, number>>({});
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  
  // Mock current reputation if not in user object, default to 0
  const currentRep = (user as any)?.reputation || 0;

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const publicRules = await backendApi.getPublicReputationRules();
        const rulesMap: Record<string, number> = {};
        publicRules.forEach((rule: any) => {
          rulesMap[rule.rule_name] = rule.rule_value;
        });
        setRules(rulesMap);
      } catch (err) {
        console.error('Failed to load reputation rules:', err);
      } finally {
        setIsLoadingRules(false);
      }
    };
    fetchRules();
  }, []);

  // Get values from rules or use defaults
  const getRule = (name: string, defaultValue: number) => rules[name] || defaultValue;

  const getTier = (rep: number) => {
    const veteran = getRule('REPUTATION_TIER_VETERAN', 1000);
    const trusted = getRule('REPUTATION_TIER_TRUSTED', 500);
    const regular = getRule('REPUTATION_TIER_REGULAR', 100);
    
    if (rep >= veteran) return { name: 'Veteran', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-700' };
    if (rep >= trusted) return { name: 'Trusted', color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-200 dark:border-teal-700' };
    if (rep >= regular) return { name: 'Regular', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700' };
    return { name: 'New Contributor', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' };
  };

  const currentTier = getTier(currentRep);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/dashboard" className="inline-flex items-center text-slate-500 hover:text-marine-600 mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
      </Link>

      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 rounded-full mb-6">
          <Award size={48} />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Reputation System</h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          High-quality contributions earn you status. High status earns you protection.
        </p>
        {user && (
           <div className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border ${currentTier.bg} ${currentTier.border}`}>
              <span className={`font-bold ${currentTier.color}`}>{currentTier.name} Tier</span>
              <span className="text-slate-600 dark:text-slate-300">({currentRep} Points)</span>
           </div>
        )}
      </div>

      {/* Reputation History Chart - Show only if user is logged in */}
      {user && user.id && (
        <div className="mb-16">
          <ReputationHistoryChart userId={user.id} />
        </div>
      )}

      {/* The Reputation Shield Section */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="text-marine-500" size={28} />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">The Reputation Shield</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
            We value long-term contributors. As you gain reputation, you gain a <strong>Shield</strong>. 
            This shield protects you from penalties when mistakes happen. 
            <span className="block mt-2 text-sm italic opacity-80">
                Note: "Cascading Penalty" means penalties normally increase ({getRule('BASE_REJECTION_PENALTY', -5)}, {getRule('BASE_REJECTION_PENALTY', -5) * 2}, {getRule('BASE_REJECTION_PENALTY', -5) * 3}...) if you have multiple rejections in {getRule('REJECTION_LOOKBACK_DAYS', 14)} days.
            </span>
        </p>

        <div className="grid md:grid-cols-4 gap-4">
            {/* Tier 0 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">New User</h3>
                <div className="text-xs font-mono text-slate-400 mb-4">0 - {getRule('REPUTATION_TIER_REGULAR', 100) - 1} REP</div>
                <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                        <span><strong>No Shield</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>Full cascading penalties (up to {getRule('MAX_REJECTION_PENALTY', -50)})</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-red-500 font-bold">{getRule('BASE_FALSE_REJECTION_PENALTY', -10)}</span>
                        <span>False Rejection Penalty</span>
                    </li>
                </ul>
            </div>

            {/* Tier 1 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-blue-200 dark:border-blue-900 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">Regular</h3>
                <div className="text-xs font-mono text-blue-400 mb-4">{getRule('REPUTATION_TIER_REGULAR', 100)} - {getRule('REPUTATION_TIER_TRUSTED', 500) - 1} REP</div>
                <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <Shield size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <span><strong>Iron Shield</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <CheckCard />
                        <span>Rejection penalty capped at <strong>-10</strong></span>
                    </li>
                     <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-red-500 font-bold">{getRule('BASE_FALSE_REJECTION_PENALTY', -10)}</span>
                        <span>False Rejection Penalty</span>
                    </li>
                </ul>
            </div>

            {/* Tier 2 */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-teal-200 dark:border-teal-900 relative overflow-hidden shadow-md transform md:-translate-y-2">
                <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                <h3 className="text-lg font-bold text-teal-600 dark:text-teal-400 mb-1">Trusted</h3>
                <div className="text-xs font-mono text-teal-400 mb-4">{getRule('REPUTATION_TIER_TRUSTED', 500)} - {getRule('REPUTATION_TIER_VETERAN', 1000) - 1} REP</div>
                <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <ShieldCheck size={16} className="text-teal-500 shrink-0 mt-0.5" />
                        <span><strong>Silver Shield</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <CheckCard />
                        <span>Rejection penalty capped at <strong>-5</strong></span>
                    </li>
                     <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-amber-500 font-bold">-5</span>
                        <span>False Rejection Penalty</span>
                    </li>
                </ul>
            </div>

            {/* Tier 3 */}
            <div className="bg-gradient-to-b from-yellow-50 to-white dark:from-slate-800 dark:to-slate-900 p-6 rounded-xl border border-yellow-300 dark:border-yellow-700 relative overflow-hidden shadow-lg transform md:-translate-y-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
                <h3 className="text-lg font-bold text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-2">
                    Veteran <Star size={14} fill="currentColor" />
                </h3>
                <div className="text-xs font-mono text-yellow-500 mb-4">{getRule('REPUTATION_TIER_VETERAN', 1000)}+ REP</div>
                <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2 text-slate-900 dark:text-white font-medium">
                        <Zap size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                        <span><strong>Gold Shield</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <CheckCard />
                        <span>Rejection penalty capped at <strong>-2</strong></span>
                    </li>
                     <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <span className="font-mono text-amber-500 font-bold">-2</span>
                        <span>False Rejection Penalty</span>
                    </li>
                </ul>
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Gaining Reputation */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gaining Points</h2>
          </div>
          <ul className="space-y-4">
            <li className="flex items-start">
              <Star className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">+{getRule('TRANSLATION_MERGED', 10)} Points</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">For every translation submitted that gets merged (final approval).</p>
              </div>
            </li>
            <li className="flex items-start">
              <ThumbsUp className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">+{getRule('TRANSLATION_APPROVED', 5)} Points</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">For every translation that gets approved by a reviewer.</p>
              </div>
            </li>
            <li className="flex items-start">
              <Award className="w-5 h-5 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">+{getRule('TRANSLATION_CREATED', 1)} Point</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">For creating a new translation.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Losing Reputation */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              <ThumbsDown size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Losing Points</h2>
          </div>
           <ul className="space-y-4">
            <li className="flex items-start">
              <div className="w-5 h-5 flex items-center justify-center font-bold text-red-500 mt-0.5 mr-3">{getRule('BASE_REJECTION_PENALTY', -5)}+</div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Cascading Rejection</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Starts at {getRule('BASE_REJECTION_PENALTY', -5)}. If you have multiple rejections in {getRule('REJECTION_LOOKBACK_DAYS', 14)} days, the penalty increases (max: {getRule('MAX_REJECTION_PENALTY', -50)}). 
                    <span className="text-teal-600 dark:text-teal-400 font-medium"> Use your shield to cap this!</span>
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-5 h-5 flex items-center justify-center font-bold text-amber-500 mt-0.5 mr-3">{getRule('BASE_FALSE_REJECTION_PENALTY', -10)}</div>
              <div>
                 <span className="font-bold text-slate-900 dark:text-white">False Rejection</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Reviewers who incorrectly reject valid work lose points. 
                    <span className="text-teal-600 dark:text-teal-400 font-medium"> High rep reduces this penalty.</span>
                </p>
              </div>
            </li>
             <li className="flex items-start">
              <div className="w-5 h-5 flex items-center justify-center font-bold text-red-500 mt-0.5 mr-3">-20</div>
              <div>
                 <span className="font-bold text-slate-900 dark:text-white">Spam / Abuse</span>
                <p className="text-slate-600 dark:text-slate-400 text-sm">For submitting low-effort, machine-generated spam, or vandalism.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Zero Tolerance Policy */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-8 rounded-2xl flex flex-col md:flex-row gap-6 items-start">
        <div className="p-4 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex-shrink-0">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Zero Tolerance for Abuse</h3>
          <p className="text-red-800 dark:text-red-200 mb-4 leading-relaxed">
            We are building a scientific resource for the global community. Severely disruptive behavior, including:
          </p>
          <ul className="list-disc list-inside text-red-800 dark:text-red-200 mb-4 space-y-1">
            <li>Intentionally incorrect translations (vandalism)</li>
            <li>Hate speech or inappropriate language</li>
            <li>Botting or automated spamming</li>
          </ul>
          <p className="text-red-800 dark:text-red-200 font-bold">
            ...will result in an immediate permanent ban and IP blocking.
          </p>
        </div>
      </div>
    </div>
  );
};

const CheckCard = () => (
    <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
    </div>
);

export default Reputation;
