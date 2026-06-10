
import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Target, Calendar, TrendingUp, Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { backendApi } from '../../services/api';
import { ApiCommunityGoal, ApiCommunityGoalProgress } from '../../types';
import toast from 'react-hot-toast';

interface Language {
  code: string;
  name: string;
  native_name: string;
}

interface Source {
  source_id: number;
  source_path: string;
  graph_name: string;
  description?: string;
  created_at: string;
}

const AdminCommunityGoals: React.FC = () => {
  const location = useLocation();
  const [goals, setGoals] = useState<ApiCommunityGoal[]>([]);
  const [progress, setProgress] = useState<Record<number, ApiCommunityGoalProgress>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ApiCommunityGoal | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'translation_count' as 'translation_count' | 'collection',
    target_count: '',
    target_language: '',
    collection_id: '',
    is_recurring: false,
    recurrence_type: '' as 'daily' | 'weekly' | 'monthly' | '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true
  });

  useEffect(() => {
    fetchGoals();
    fetchLanguages();
    fetchSources();
  }, []);

  // Refetch goals when URL path or hash changes
  useEffect(() => {
    fetchGoals();
  }, [location.pathname, location.hash]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const goalsData = await backendApi.get<ApiCommunityGoal[]>('/admin/community-goals');
      setGoals(goalsData);

      // Fetch progress for each goal
      const progressData: Record<number, ApiCommunityGoalProgress> = {};
      await Promise.all(
        goalsData.map(async (goal) => {
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
      console.error('Failed to fetch goals:', error);
      toast.error('Failed to load community goals');
    } finally {
      setLoading(false);
    }
  };

  const fetchLanguages = async () => {
    try {
      const langs = await backendApi.get<Language[]>('/languages');
      setLanguages(langs);
    } catch (error) {
      console.error('Failed to fetch languages:', error);
      toast.error('Failed to load languages');
    }
  };

  const fetchSources = async () => {
    try {
      const response = await backendApi.get<{ sources: Source[] }>('/sources?limit=100');
      setSources(response.sources || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      toast.error('Failed to load sources');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate end date is after start date
    if (formData.end_date && formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      
      if (endDate <= startDate) {
        toast.error('End date must be after start date');
        return;
      }
    }
    
    // Validate collection goal without count requires language
    if (formData.goal_type === 'collection' && !formData.target_count && !formData.target_language) {
      toast.error('Collection goals without target count must have a target language');
      return;
    }
    
    // Validate collection goal requires collection_id
    if (formData.goal_type === 'collection' && !formData.collection_id) {
      toast.error('Collection goals require a source/collection to be selected');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        target_count: formData.target_count ? parseInt(formData.target_count) : null,
        collection_id: formData.collection_id ? parseInt(formData.collection_id) : null,
        target_language: formData.target_language || null,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
        end_date: formData.end_date || null,
        is_active: formData.is_active ? 1 : 0,
        is_recurring: formData.is_recurring ? 1 : 0
      };

      if (editingGoal) {
        await backendApi.put(`/admin/community-goals/${editingGoal.id}`, payload);
        toast.success('Goal updated successfully');
      } else {
        await backendApi.post('/admin/community-goals', payload);
        toast.success('Goal created successfully');
      }

      resetForm();
      fetchGoals();
    } catch (error) {
      console.error('Failed to save goal:', error);
      toast.error('Failed to save goal');
    }
  };

  const handleEdit = (goal: ApiCommunityGoal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      goal_type: goal.goal_type,
      target_count: goal.target_count?.toString() || '',
      target_language: goal.target_language || '',
      collection_id: goal.collection_id?.toString() || '',
      is_recurring: goal.is_recurring === 1,
      recurrence_type: goal.recurrence_type || '',
      start_date: goal.start_date.split('T')[0],
      end_date: goal.end_date ? goal.end_date.split('T')[0] : '',
      is_active: goal.is_active === 1
    });
    setShowForm(true);
  };

  const handleDelete = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      await backendApi.delete(`/admin/community-goals/${goalId}`);
      toast.success('Goal deleted successfully');
      fetchGoals();
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Failed to delete goal');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      goal_type: 'translation_count',
      target_count: '',
      target_language: '',
      collection_id: '',
      is_recurring: false,
      recurrence_type: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_active: true
    });
    setEditingGoal(null);
    setShowForm(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Community Goals</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage community-wide translation goals and challenges
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Goal'}
          </button>
        </div>

      {/* Goal Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {editingGoal ? 'Edit Goal' : 'Create New Goal'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="e.g., Translate 50 French terms this month"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Additional details about the goal..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Goal Type *
                </label>
                <select
                  value={formData.goal_type}
                  onChange={(e) => setFormData({ ...formData, goal_type: e.target.value as 'translation_count' | 'collection' })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="translation_count">Translation Count</option>
                  <option value="collection">Collection</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Language {formData.goal_type === 'collection' && !formData.target_count && '*'}
                </label>
                <select
                  value={formData.target_language}
                  onChange={(e) => setFormData({ ...formData, target_language: e.target.value })}
                  required={formData.goal_type === 'collection' && !formData.target_count}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">All Languages</option>
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} ({lang.code.toUpperCase()})
                    </option>
                  ))}
                </select>
                {formData.goal_type === 'collection' && !formData.target_count && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Required for collection goals without target count
                  </p>
                )}
              </div>

              {/* Target Count - available for both goal types */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Count {formData.goal_type === 'translation_count' && '*'}
                </label>
                <input
                  type="number"
                  value={formData.target_count}
                  onChange={(e) => setFormData({ ...formData, target_count: e.target.value })}
                  required={formData.goal_type === 'translation_count'}
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Number of translations"
                />
                {formData.goal_type === 'collection' && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Optional - leave empty to track all translations in collection
                  </p>
                )}
              </div>

              {formData.goal_type === 'collection' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Collection / Source *
                  </label>
                  <select
                    value={formData.collection_id}
                    onChange={(e) => setFormData({ ...formData, collection_id: e.target.value })}
                    required={formData.goal_type === 'collection'}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">Select a collection...</option>
                    {sources.map((source) => (
                      <option key={source.source_id} value={source.source_id}>
                        {source.source_path} (ID: {source.source_id})
                      </option>
                    ))}
                  </select>
                  {formData.collection_id && sources.find(s => s.source_id === parseInt(formData.collection_id)) && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p>
                        <span className="font-semibold">Graph:</span> {sources.find(s => s.source_id === parseInt(formData.collection_id))?.graph_name || 'N/A'}
                      </p>
                      {sources.find(s => s.source_id === parseInt(formData.collection_id))?.description && (
                        <p>
                          <span className="font-semibold">Description:</span> {sources.find(s => s.source_id === parseInt(formData.collection_id))?.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Recurring Goal
                  </span>
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recurrence Type *
                  </label>
                  <select
                    value={formData.recurrence_type}
                    onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value as any })}
                    required={formData.is_recurring}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">Select frequency</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Active
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingGoal ? 'Update Goal' : 'Create Goal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals List */}
      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">
          Loading goals...
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-12 text-center border border-slate-200 dark:border-slate-700">
          <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No Community Goals Yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Create your first community goal to motivate translators
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const goalProgress = progress[goal.id];
            
            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        goal.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {goal.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                        {goal.goal_type === 'translation_count' ? 'Translation Count' : 'Collection'}
                      </span>
                      {goal.target_language && (
                        <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded uppercase">
                          {goal.target_language}
                        </span>
                      )}
                      {goal.is_recurring === 1 && (
                        <span className="text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded capitalize">
                          {goal.recurrence_type}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                        {goal.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(goal.start_date)}</span>
                        {goal.end_date && (
                          <>
                            <span>→</span>
                            <span>{formatDate(goal.end_date)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        <span>Created by {goal.created_by_username}</span>
                      </div>
                    </div>
                    {goal.linked_communities && goal.linked_communities.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Linked to:</span>
                        {goal.linked_communities.map((community) => (
                          <span
                            key={community.id}
                            className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded"
                          >
                            {community.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {goalProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Progress: {goalProgress.current_count} / {goalProgress.target_count || '∞'}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {goalProgress.progress_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          goalProgress.is_complete
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500'
                        }`}
                        style={{ width: `${Math.min(goalProgress.progress_percentage, 100)}%` }}
                      />
                    </div>
                    {goalProgress.missing_translations && Object.keys(goalProgress.missing_translations).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Missing Translations:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(goalProgress.missing_translations).map(([lang, count]) => (
                            <span
                              key={lang}
                              className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded"
                            >
                              {lang.toUpperCase()}: {count} remaining
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
};

export default AdminCommunityGoals;
