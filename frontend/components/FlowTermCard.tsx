import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Send, Globe, ExternalLink, Sparkles, Loader2, Quote, MessageSquare, Target, TrendingUp, Calendar, Clock, AlertCircle, PlusCircle, Edit3, SkipForward, GripHorizontal } from 'lucide-react';
import { CONFIG } from '../config';
import toast from 'react-hot-toast';
import { ApiCommunityGoal, ApiCommunityGoalProgress } from '../types';
import { useOpenRouterApiKey } from '../hooks/useOpenRouterApiKey';
import { getTranslationHistory } from '../services/flow.api';
import { useDraggable } from '../hooks/useDraggable';

interface FlowTermCardProps {
  task: any;
  taskType: 'review' | 'translate' | 'rework' | 'discussion';
  languages: Array<{ code: string; name: string }>;
  onSubmitReview: (action: 'approve' | 'reject' | 'discuss', rejectionReason?: string, discussionMessage?: string, discussionTranslation?: string) => void;
  onSubmitTranslation: (language: string, value: string, resubmissionMotivation?: string) => void;
  onSkipTask: () => void;
  isSubmitting: boolean;
  relevantGoal?: { goal: ApiCommunityGoal; progress: ApiCommunityGoalProgress } | null;
  linkedNotification?: any | null;
}

const FlowTermCard: React.FC<FlowTermCardProps> = ({
  task,
  taskType,
  languages,
  onSubmitReview,
  onSubmitTranslation,
  onSkipTask,
  isSubmitting,
  relevantGoal,
  linkedNotification = null,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0]?.code || 'nl');
  const [translationValue, setTranslationValue] = useState('');
  const [resubmissionMotivation, setResubmissionMotivation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { apiKey, hasApiKey, isLoading: isLoadingApiKey } = useOpenRouterApiKey();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDiscussModal, setShowDiscussModal] = useState(false);
  const [discussionTranslation, setDiscussionTranslation] = useState('');
  const [discussionMessage, setDiscussionMessage] = useState('');
  const rejectDraggable = useDraggable();
  const discussDraggable = useDraggable();
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Update selected language if languages prop changes (e.g. from loading state)
  useEffect(() => {
    if (languages.length > 0 && !languages.find(l => l.code === selectedLanguage)) {
        setSelectedLanguage(languages[0].code);
    }
  }, [languages, selectedLanguage]);

  // Pre-fill translation value for rework and discussion tasks
  useEffect(() => {
    if ((taskType === 'rework' || taskType === 'discussion') && task?.value) {
      setTranslationValue(task.value);
      // Pre-fill resubmission motivation if it was previously provided
      setResubmissionMotivation(task.resubmission_motivation || '');
    } else {
      setTranslationValue('');
      setResubmissionMotivation('');
    }
  }, [taskType, task]);

  // Load history for review tasks
  useEffect(() => {
    if ((taskType === 'review' || taskType === 'rework' || taskType === 'discussion' || task?.status === 'approved' || task?.status === 'merged') && task?.translation_id) {
      loadHistory();
      if (linkedNotification && linkedNotification.translation_id === task.translation_id) {
        setShowHistory(true);
      }
    }
  }, [taskType, task, linkedNotification]);

  // Scroll matched notification entry into view
  useEffect(() => {
    if (showHistory && linkedNotification && history.length > 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById('highlighted-history-entry');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showHistory, history, linkedNotification]);

  const loadHistory = async () => {
    if (!task?.translation_id) return;
    
    setHistoryLoading(true);
    try {
      const result = await getTranslationHistory(task.translation_id);
      setHistory(result.history || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReject = () => {
    rejectDraggable.resetPosition();
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setShowRejectModal(false);
    onSubmitReview('reject', rejectionReason.trim());
    setRejectionReason('');
  };

  const handleDiscuss = () => {
    discussDraggable.resetPosition();
    setDiscussionTranslation(task?.value || '');
    setDiscussionMessage('');
    setShowDiscussModal(true);
  };

  const handleDiscussSubmit = () => {
    if (!discussionTranslation.trim()) {
      toast.error('Please provide a proposed translation');
      return;
    }
    setShowDiscussModal(false);
    onSubmitReview('discuss', undefined, discussionMessage.trim() || undefined, discussionTranslation.trim());
    setDiscussionTranslation('');
    setDiscussionMessage('');
    // Reload history after a brief delay to ensure the backend has saved the discussion
    setTimeout(() => loadHistory(), 500);
  };

  const formatHistoryAction = (action: string) => {
    switch (action) {
      case 'translation_created': return 'Created';
      case 'translation_edited': return 'Edited';
      case 'translation_approved': return 'Approved';
      case 'translation_rejected': return 'Rejected';
      case 'translation_status_changed': return 'Status Changed';
      case 'translation_discussion': return 'Discussion';
      default: return action.replace(/_/g, ' ');
    }
  };

  const renderHistoryEntry = (entry: any) => {
    let extra: any = {};
    try {
      extra = entry.extra ? JSON.parse(entry.extra) : {};
    } catch (e) {
      console.error('Failed to parse history extra:', e);
    }

    // Determine the translation value to display for this entry.
    // For create/edit we use the value stored in extra at the time of the action.
    // For status changes / discussion we stored translation_value in extra (new entries)
    // and fall back to current_translation_value for older entries.
    const displayValue: string | undefined =
      extra.value ||                      // translation_created
      extra.translation_value ||          // status_changed, approved, rejected, discussion (new)
      entry.current_translation_value;    // fallback: current value from backend

    const isMatched = linkedNotification && 
      linkedNotification.created_by_id === entry.user_id && 
      (
        (linkedNotification.type === 'discussion_reply' && entry.action === 'translation_discussion') ||
        (linkedNotification.type === 'translation_approved' && (entry.action === 'translation_approved' || entry.action === 'translation_status_changed')) ||
        (linkedNotification.type === 'translation_rejected' && (entry.action === 'translation_rejected' || entry.action === 'translation_status_changed'))
      ) &&
      Math.abs(new Date(linkedNotification.created_at).getTime() - new Date(entry.created_at).getTime()) < 5000;

    return (
      <div
        key={entry.id}
        id={isMatched ? "highlighted-history-entry" : undefined}
        className={`bg-white dark:bg-slate-800 rounded-lg p-3 border shadow-sm hover:shadow-md transition-shadow ${
          isMatched 
            ? 'notification-highlight border-blue-500 dark:border-blue-500' 
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 text-slate-600 dark:text-slate-400">
            {getActionIcon(entry.action)}
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {formatHistoryAction(entry.action)}
              </span>
              {(entry.display_name || entry.username) && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  by <a
                    href={`#/user/${entry.user_id}`}
                    className="font-medium text-marine-600 dark:text-marine-400 hover:text-marine-700 dark:hover:text-marine-300 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `#/user/${entry.user_id}`;
                    }}
                  >
                    {entry.display_name || entry.username}
                  </a>
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
                {formatDate(entry.created_at)}
              </span>
            </div>

            {/* Status transition badges */}
            {extra.old_status && extra.new_status && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(extra.old_status)}`}>
                  {extra.old_status}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-slate-400 flex-shrink-0">
                  <path d="M10 3l5 5-5 5V9H1V7h9V3z"/>
                </svg>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(extra.new_status)}`}>
                  {extra.new_status}
                </span>
              </div>
            )}

            {/* Translation value at time of creation */}
            {entry.action === 'translation_created' && extra.value && (
              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 border-l-2 border-slate-300 dark:border-slate-600 rounded">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-0.5">Initial Translation:</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap font-medium">
                  {extra.value}
                </div>
              </div>
            )}

            {/* Before/after diff for edits */}
            {entry.action === 'translation_edited' && (extra.old_value || extra.new_value) && (
              <div className="mt-2 space-y-1">
                {extra.old_value && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/10 border-l-2 border-red-300 dark:border-red-700 rounded">
                    <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-0.5">Before:</div>
                    <div className="text-xs text-red-600 dark:text-red-400 break-words whitespace-pre-wrap line-through opacity-75">
                      {extra.old_value}
                    </div>
                  </div>
                )}
                {extra.new_value && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/10 border-l-2 border-emerald-400 dark:border-emerald-600 rounded">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">After:</div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 break-words whitespace-pre-wrap font-medium">
                      {extra.new_value}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Translation value for status changes, approvals, rejections, and discussions */}
            {entry.action !== 'translation_created' && entry.action !== 'translation_edited' && displayValue && (
              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 border-l-2 border-slate-300 dark:border-slate-600 rounded">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-0.5">Translation:</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap font-medium">
                  {displayValue}
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {extra.rejection_reason && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border-l-2 border-red-400 dark:border-red-600 rounded">
                <div className="text-xs font-medium text-red-800 dark:text-red-300 mb-0.5">Rejection Reason:</div>
                <div className="text-xs text-red-700 dark:text-red-400 break-words whitespace-pre-wrap">
                  {extra.rejection_reason}
                </div>
              </div>
            )}

            {/* Discussion message */}
            {extra.discussion_message && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-600 rounded">
                <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-0.5">Discussion:</div>
                <div className="text-xs text-blue-700 dark:text-blue-400 break-words whitespace-pre-wrap">
                  {extra.discussion_message}
                </div>
              </div>
            )}

            {/* Resubmission motivation / user's response */}
            {extra.resubmission_motivation && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-600 rounded">
                <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-0.5">User's Response:</div>
                <div className="text-xs text-blue-700 dark:text-blue-400 break-words whitespace-pre-wrap">
                  {extra.resubmission_motivation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!task) {
    return null;
  }

  const handleTranslationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (translationValue.trim()) {
      const trimmedMotivation = resubmissionMotivation.trim();
      onSubmitTranslation(selectedLanguage, translationValue.trim(), trimmedMotivation ? trimmedMotivation : undefined);
      setTranslationValue('');
      setResubmissionMotivation('');
    }
  };

  const handleAiSuggest = async () => {
    if (!selectedLanguage) {
      toast.error("Please select a target language first");
      return;
    }

    if (!apiKey) {
      toast.error("Please configure your OpenRouter API key in Settings");
      return;
    }

    setAiLoading(true);

    try {
      const modelsResponse = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        }
      });

      if (!modelsResponse.ok) throw new Error("Failed to fetch models");

      const modelsData = await modelsResponse.json();
      const freeModels = modelsData.data.filter((m: any) => m.id.includes(":free"));

      if (freeModels.length === 0) throw new Error("No free models available");

      const prompt = `You are a professional marine scientist and translator.
Translate the following text into ${selectedLanguage}.
Keep the translation scientific, accurate, and natural.
Do not add explanations, only provide the translation.
Original Text (${task.field_uri || 'field'}): "${task.original_value}"`;

      let suggestion: string | null = null;
      
      for (const model of freeModels) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model.id,
              messages: [{ role: "user", content: prompt }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim();
            if (content) {
              suggestion = content.replace(/^["']|["']$/g, '');
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (suggestion) {
        setTranslationValue(suggestion);
        toast.success("AI suggestion generated!");
      } else {
        toast.error("Could not generate a suggestion");
      }

    } catch (error) {
      console.error("AI Error:", error);
      toast.error("Failed to generate AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  // Extract term information from task using field_role with fallback
  const getTermField = (fieldRole: string, fallbackFieldTerm?: string) => {
    if (!task.term_fields || !Array.isArray(task.term_fields)) return null;
    // First try to find by field_role
    const fieldByRole = task.term_fields.find((f: any) => f.field_role === fieldRole);
    if (fieldByRole) return fieldByRole;
    // Fallback to field_term if provided
    if (fallbackFieldTerm) {
      return task.term_fields.find((f: any) => 
        f.field_term && f.field_term.includes(fallbackFieldTerm)
      );
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // If less than 1 hour ago, show minutes
    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    }
    // If less than 24 hours ago, show hours
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    // If less than 7 days ago, show days
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    // Otherwise show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'merged':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'rejected':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'review':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'draft':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'translation_created':
        return <PlusCircle size={14} className="flex-shrink-0" />;
      case 'translation_edited':
        return <Edit3 size={14} className="flex-shrink-0" />;
      case 'translation_approved':
        return <CheckCircle size={14} className="flex-shrink-0" />;
      case 'translation_rejected':
        return <XCircle size={14} className="flex-shrink-0" />;
      case 'translation_status_changed':
        return <Clock size={14} className="flex-shrink-0" />;
      default:
        return <AlertCircle size={14} className="flex-shrink-0" />;
    }
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

  const isCompleted = task?.status === 'approved' || task?.status === 'merged';

  const labelField = getTermField('label', 'prefLabel');
  const refField = getTermField('reference', 'definition');
  
  const prefLabel = labelField?.original_value || task.term_uri || task.uri || 'Unknown Term';
  const definition = refField?.original_value || prefLabel;
  
  // Try to find URI
  const termUri = task.term_uri || task.uri || null;

  return (
    <div className="bg-white dark:bg-slate-800 md:rounded-xl md:shadow-lg md:border md:border-slate-200 md:dark:border-slate-700 overflow-hidden md:max-w-3xl md:mx-auto">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/50 px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start gap-2 overflow-hidden">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
               {taskType === 'review' ? 'Review Task' : taskType === 'rework' ? 'Rework Task' : taskType === 'discussion' ? 'Discussion Task' : 'Translation Task'}
             </span>
             {taskType === 'review' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  Verify
                </span>
             ) : taskType === 'rework' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Improve
                </span>
             ) : taskType === 'discussion' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Discuss
                </span>
             ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Contribute
                </span>
             )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0 truncate">
            {prefLabel}
            {termUri && (
                <a 
                  href={termUri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-slate-400 hover:text-marine-600 transition-colors"
                  title="View on NERC Vocabulary Server"
                >
                  <ExternalLink size={18} />
                </a>
            )}
          </h2>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
             <Globe className="w-6 h-6 text-marine-500" />
        </div>
      </div>

      <div className="p-4 md:p-8">
        {/* Completed Task Alert Banner */}
        {isCompleted && (
          <div className="mb-6 p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-base">Translation Completed</h4>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  This translation has already been {task.status.toLowerCase()} and is closed for reviews.
                </p>
              </div>
            </div>
            <button
              onClick={onSkipTask}
              className="flex-shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Go to Next Task
            </button>
          </div>
        )}

        {/* Context: Definition */}
        <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Quote size={12} /> Context (Definition)
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic border-l-4 border-slate-200 dark:border-slate-700 pl-4 py-1 break-words">
                {definition}
            </p>
        </div>

        {/* Source Field */}
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-md bg-marine-100 dark:bg-marine-900/30 text-marine-700 dark:text-marine-300 text-xs font-mono font-bold border border-marine-200 dark:border-marine-800 truncate max-w-full">
                    {task.field_uri?.split('/').pop()?.split('#').pop() || 'Unknown Field'}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Source Text to {taskType === 'review' ? 'Verify' : taskType === 'rework' ? 'Improve' : taskType === 'discussion' ? 'Discuss' : 'Translate'}
                </span>
            </div>
            <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-lg text-slate-800 dark:text-white font-medium leading-relaxed shadow-inner overflow-wrap-anywhere">
                {task.original_value && task.original_value.trim() ? (
                    task.original_value
                ) : (
                    <div className="flex items-start gap-3 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold mb-1">No source content available</p>
                            <p className="text-amber-700 dark:text-amber-300">
                                The source vocabulary does not provide content for this field. 
                                Please visit the <a 
                                    href={task.term_uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="underline hover:text-amber-800 dark:hover:text-amber-200"
                                >
                                    original term
                                </a> to understand the context before creating new content.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 my-8"></div>

        {/* Action Area */}
        {isCompleted && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div className="flex-grow">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Completed Translation ({task.language?.toUpperCase()})
                </label>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-lg text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 overflow-wrap-anywhere">
                  {task.value}
                </div>
                {task.created_by && (
                  <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <span>Submitted by</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300 truncate">{task.created_by}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Translation History - Shows list */}
            {history.length > 0 && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-marine-500" />
                    <span>Translation History</span>
                    <span className="ml-1 px-2 py-0.5 bg-marine-100 dark:bg-marine-900/40 text-marine-700 dark:text-marine-300 rounded-full text-xs font-bold">
                      {history.length}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  {history.map((entry) => renderHistoryEntry(entry))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isCompleted && taskType === 'review' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                 <div className="flex items-start gap-4">
                     <div className="flex-grow">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                             Proposed Translation ({task.language?.toUpperCase()})
                        </label>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-lg text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 overflow-wrap-anywhere">
                             {task.value}
                        </div>
                        {task.created_by && (
                           <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                              <span>Submitted by</span>
                              <span className="font-medium text-slate-600 dark:text-slate-300 truncate">{task.created_by}</span>
                           </div>
                        )}
                        {task.resubmission_motivation && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Translator's Response/Motivation:</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400 break-words whitespace-pre-wrap">{task.resubmission_motivation}</p>
                              </div>
                            </div>
                          </div>
                        )}
                     </div>
                 </div>

                 {/* Translation History */}
                 {history.length > 0 && (
                   <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                     <button
                       onClick={() => setShowHistory(!showHistory)}
                       className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-marine-600 dark:hover:text-marine-400 transition-colors"
                     >
                       <div className="flex items-center gap-2">
                         <Clock size={18} className="text-marine-500" />
                         <span>Translation History</span>
                         <span className="ml-1 px-2 py-0.5 bg-marine-100 dark:bg-marine-900/40 text-marine-700 dark:text-marine-300 rounded-full text-xs font-bold">
                           {history.length}
                         </span>
                       </div>
                       <span className={`transform transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                         <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                           <path d="M4 6l4 4 4-4z"/>
                         </svg>
                       </span>
                     </button>
                     
                     {showHistory && (
                       <div className="mt-4 space-y-3">
                         {history.map((entry) => renderHistoryEntry(entry))}
                       </div>
                     )}
                   </div>
                 )}

                 <div className="flex gap-2 md:gap-4 pt-4">
                    <button
                        onClick={handleReject}
                        disabled={isSubmitting}
                        aria-label="Reject translation"
                        className="flex-1 flex items-center justify-center gap-2 px-3 md:px-6 py-4 bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        <XCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Reject</span>
                    </button>
                    <button
                        onClick={handleDiscuss}
                        disabled={isSubmitting}
                        aria-label="Discuss translation"
                        className="flex-1 flex items-center justify-center gap-2 px-3 md:px-6 py-4 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        <MessageSquare className="w-5 h-5" />
                        <span className="hidden md:inline">Discuss</span>
                    </button>
                    <button
                        onClick={() => onSubmitReview('approve')}
                        disabled={isSubmitting}
                        aria-label="Approve translation"
                        className="flex-[2] flex items-center justify-center gap-2 px-3 md:px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Approve Translation</span>
                    </button>
                </div>
                 <button
                     type="button"
                     onClick={onSkipTask}
                     disabled={isSubmitting}
                     className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl font-medium transition-all disabled:opacity-50"
                 >
                     <SkipForward className="w-5 h-5" />
                     Skip Task
                 </button>
            </div>
        )}

        {taskType === 'discussion' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                {/* Current Translation Display */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex items-start gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Translation in Discussion
                    </h3>
                  </div>
                  <div className="ml-7 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                        Current Translation ({task.language?.toUpperCase()}):
                      </label>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 text-sm text-slate-900 dark:text-white">
                        {task.value}
                      </div>
                    </div>
                    {task.created_by && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <span>Originally submitted by</span>
                        <span className="font-medium truncate">{task.created_by}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Translation History - Shows the discussion thread */}
                {history.length > 0 && (
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-marine-600 dark:hover:text-marine-400 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-marine-500" />
                        <span>Discussion History</span>
                        <span className="ml-1 px-2 py-0.5 bg-marine-100 dark:bg-marine-900/40 text-marine-700 dark:text-marine-300 rounded-full text-xs font-bold">
                          {history.length}
                        </span>
                      </div>
                      <span className={`transform transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4 6l4 4 4-4z"/>
                        </svg>
                      </span>
                    </button>
                    
                    {showHistory && (
                      <div className="mt-4 space-y-3">
                        {history.map((entry) => renderHistoryEntry(entry))}
                      </div>
                    )}
                  </div>
                )}

                {/* Update Translation Form */}
                <form onSubmit={handleTranslationSubmit} className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-start gap-2 mb-3">
                      <Edit3 className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Update Translation & Continue Discussion
                      </h3>
                    </div>
                    <div className="ml-7 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Updated Translation ({task.language?.toUpperCase()})
                        </label>
                        <textarea
                          value={translationValue}
                          onChange={(e) => setTranslationValue(e.target.value)}
                          placeholder={`Update your translation here...`}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-marine-500 focus:ring-2 focus:ring-marine-500/20 transition-all resize-none"
                          rows={3}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Explanation of Changes (Optional)
                        </label>
                        <textarea
                          value={resubmissionMotivation}
                          onChange={(e) => setResubmissionMotivation(e.target.value)}
                          placeholder="Explain why you updated the translation..."
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-marine-500 focus:ring-2 focus:ring-marine-500/20 transition-all resize-none"
                          rows={3}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !translationValue.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-marine-500 to-teal-500 hover:from-marine-600 hover:to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-marine-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Update Translation
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Action Buttons - Reply to Discussion or Make Decision */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MessageSquare className="w-4 h-4" />
                    <span>Or add a comment without updating the translation:</span>
                  </div>
                  <div className="flex gap-4">
                    <button
                        onClick={handleDiscuss}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                    >
                        <MessageSquare className="w-5 h-5" />
                        Add Comment
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 pt-2">
                    <span>Or make a final decision on this translation:</span>
                  </div>
                  <div className="flex gap-2 md:gap-4">
                    <button
                        onClick={handleReject}
                        disabled={isSubmitting}
                        aria-label="Reject translation"
                        className="flex-1 flex items-center justify-center gap-2 px-3 md:px-6 py-4 bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        <XCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Reject</span>
                    </button>
                    <button
                        onClick={() => onSubmitReview('approve')}
                        disabled={isSubmitting}
                        aria-label="Approve translation"
                        className="flex-[2] flex items-center justify-center gap-2 px-3 md:px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span className="hidden md:inline">Approve Translation</span>
                    </button>
                  </div>
                  <button
                      type="button"
                      onClick={onSkipTask}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                      <SkipForward className="w-5 h-5" />
                      Skip Task
                  </button>
                </div>
            </div>
        )}

        {taskType === 'translate' && (
            <form onSubmit={handleTranslationSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                
                {/* Language Selection - Only show if multiple languages available */}
                {languages.length > 1 && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                             Target Language
                        </label>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-marine-500 focus:border-marine-500 outline-none transition-shadow"
                            disabled={isSubmitting}
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Your Translation {languages.length === 1 && <span className="text-slate-500 font-normal">({languages[0].name})</span>}
                        </label>
                        {hasApiKey && !isLoadingApiKey && (
                          <button
                              type="button"
                              onClick={handleAiSuggest}
                              disabled={aiLoading || isSubmitting}
                              className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              AI Suggest
                          </button>
                        )}
                    </div>
                    <div className="relative">
                        <textarea
                            value={translationValue}
                            onChange={(e) => setTranslationValue(e.target.value)}
                            placeholder={`Enter ${languages.find(l => l.code === selectedLanguage)?.name || ''} translation...`}
                            rows={4}
                            className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-marine-500 focus:border-marine-500 outline-none resize-none shadow-sm transition-shadow text-lg"
                            disabled={isSubmitting}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-3">
                  <button
                      type="submit"
                      disabled={isSubmitting || !translationValue.trim()}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-marine-600 to-marine-500 hover:from-marine-700 hover:to-marine-600 text-white rounded-xl font-bold shadow-lg shadow-marine-500/20 transition-all transform hover:scale-[1.01] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                  >
                      {isSubmitting ? (
                          <>
                             <Loader2 className="w-5 h-5 animate-spin" />
                             Submitting...
                          </>
                      ) : (
                          <>
                             <Send className="w-5 h-5" />
                             Submit Translation
                          </>
                      )}
                  </button>
                  
                  <button
                      type="button"
                      onClick={onSkipTask}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                      <SkipForward className="w-5 h-5" />
                      Skip Task
                  </button>
                </div>
            </form>
        )}

        {taskType === 'rework' && (
            <form onSubmit={handleTranslationSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                {/* Rejection Notice */}
                {task.rejection_reason && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-800 dark:text-red-300 mb-1">Translation Rejected</h4>
                        <p className="text-sm text-red-700 dark:text-red-400">{task.rejection_reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous Translation */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Your Previous Translation ({task.language?.toUpperCase()})
                  </label>
                  <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 italic">
                    {task.value}
                  </div>
                </div>

                {/* Translation History */}
                {history.length > 0 && (
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-marine-600 dark:hover:text-marine-400 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-marine-500" />
                        <span>Translation History</span>
                        <span className="ml-1 px-2 py-0.5 bg-marine-100 dark:bg-marine-900/40 text-marine-700 dark:text-marine-300 rounded-full text-xs font-bold">
                          {history.length}
                        </span>
                      </div>
                      <span className={`transform transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4 6l4 4 4-4z"/>
                        </svg>
                      </span>
                    </button>
                    
                    {showHistory && (
                      <div className="mt-4 space-y-3">
                        {history.map((entry) => renderHistoryEntry(entry))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Improved Translation ({task.language?.toUpperCase()})
                        </label>
                        {hasApiKey && !isLoadingApiKey && (
                          <button
                              type="button"
                              onClick={handleAiSuggest}
                              disabled={aiLoading || isSubmitting}
                              className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              AI Suggest
                          </button>
                        )}
                    </div>
                    <div className="relative">
                        <textarea
                            value={translationValue}
                            onChange={(e) => setTranslationValue(e.target.value)}
                            placeholder="Enter your improved translation..."
                            rows={4}
                            className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-marine-500 focus:border-marine-500 outline-none resize-none shadow-sm transition-shadow text-lg"
                            disabled={isSubmitting}
                            required
                        />
                    </div>
                </div>

                {/* Resubmission Motivation */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Your Response/Motivation (Optional)
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Explain why you disagree with the rejection or describe your improvements
                    </p>
                    <textarea
                        value={resubmissionMotivation}
                        onChange={(e) => setResubmissionMotivation(e.target.value)}
                        placeholder="e.g., I believe this term is more accurate because..., The rejection was based on..., I have corrected the grammar issue by..."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-marine-500 focus:border-marine-500 outline-none resize-none shadow-sm transition-shadow"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-3">
                  <button
                      type="submit"
                      disabled={isSubmitting || !translationValue.trim()}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all transform hover:scale-[1.01] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                  >
                      {isSubmitting ? (
                          <>
                             <Loader2 className="w-5 h-5 animate-spin" />
                             Resubmitting...
                          </>
                      ) : (
                          <>
                             <Send className="w-5 h-5" />
                             Resubmit Translation
                          </>
                      )}
                  </button>
                  
                  <button
                      type="button"
                      onClick={onSkipTask}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                      <SkipForward className="w-5 h-5" />
                      Skip Task
                  </button>
                </div>
            </form>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (!rejectDraggable.wasDragging) setShowRejectModal(false); }}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full fixed"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${rejectDraggable.position.x}px), calc(-50% + ${rejectDraggable.position.y}px))`,
              cursor: rejectDraggable.isDragging ? 'grabbing' : 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-2 px-6 pt-6 pb-3 cursor-grab select-none"
              onMouseDown={rejectDraggable.handleDragStart}
              title="Drag to move"
            >
              <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Flag Translation</h3>
            </div>
            <div className="px-6 pb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Please provide a reason for flagging this translation (e.g., spam, severely lacking quality, inappropriate content, or incorrect terminology).
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Spam content, severely lacking quality, inappropriate, incorrect terminology..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Flag Translation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discussion Modal */}
      {showDiscussModal && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (!discussDraggable.wasDragging) setShowDiscussModal(false); }}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full fixed"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${discussDraggable.position.x}px), calc(-50% + ${discussDraggable.position.y}px))`,
              cursor: discussDraggable.isDragging ? 'grabbing' : 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-2 px-6 pt-6 pb-2 cursor-grab select-none"
              onMouseDown={discussDraggable.handleDragStart}
              title="Drag to move"
            >
              <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Propose a Translation</h3>
            </div>
            <div className="px-6 pb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Propose your own translation for this term. When accepted, all contributors will earn points.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Proposed Translation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={discussionTranslation}
                    onChange={(e) => setDiscussionTranslation(e.target.value)}
                    placeholder="Enter your proposed translation..."
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Explanation <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={discussionMessage}
                    onChange={(e) => setDiscussionMessage(e.target.value)}
                    placeholder="e.g., I chose this term because... Have you considered...?"
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDiscussModal(false);
                    setDiscussionTranslation('');
                    setDiscussionMessage('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDiscussSubmit}
                  disabled={!discussionTranslation.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowTermCard;
