
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiTerm, ApiField, ApiUserActivity, ApiAppeal, ApiAppealMessage, ApiPublicUser, ApiTermDiscussion, ApiTermDiscussionMessage } from '../types';
import { backendApi } from '../services/api';
import * as flowApi from '../services/flow.api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, ExternalLink, Send, Lock, Globe, Info, AlignLeft, Tag, BookOpen,
  CheckCircle, XCircle, Clock, History, AlertCircle, PlayCircle, ChevronRight,
  Edit3, MessageSquare, AlertTriangle, CheckSquare, MessageCircle, Sparkles, Loader2, Flag,
  PlusCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CONFIG } from '../config';
import { parse, format } from '@/src/utils/datetime';
import { getPreferredLabel, getLanguagePriority } from '../src/utils/languageSelector';
import { useOpenRouterApiKey } from '../hooks/useOpenRouterApiKey';

const TermDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [term, setTerm] = useState<ApiTerm | null>(null);
  const [history, setHistory] = useState<ApiUserActivity[]>([]);
  const [appeals, setAppeals] = useState<Record<number, ApiAppeal[]>>({}); // translation_id -> appeals
  const [loading, setLoading] = useState(true);

  // Form State: field_id -> translation value
  const [formValues, setFormValues] = useState<Record<number, string>>({});

  const [selectedLang, setSelectedLang] = useState('');
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([]);
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI State
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
  const { apiKey, hasApiKey, isLoading: isLoadingApiKey } = useOpenRouterApiKey();

  const [openHistoryFieldId, setOpenHistoryFieldId] = useState<number | null>(null);
  const [openAppealFieldId, setOpenAppealFieldId] = useState<number | null>(null);
  const [selectedHistoryEventId, setSelectedHistoryEventId] = useState<number | null>(null);

  // New Message State
  const [newMessage, setNewMessage] = useState<string>('');

  // Rejection Modal State
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    fieldId: number | null;
    translationId: number | null;
    reason: string;
  }>({
    isOpen: false,
    fieldId: null,
    translationId: null,
    reason: ''
  });

  // Report Message Modal State
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    messageId: number | null;
    reason: string;
  }>({
    isOpen: false,
    messageId: null,
    reason: ''
  });

  // Term Discussion State
  const [discussions, setDiscussions] = useState<ApiTermDiscussion[]>([]);
  const [showDiscussions, setShowDiscussions] = useState(true);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState('');
  const [newDiscussionMessage, setNewDiscussionMessage] = useState('');
  const [discussionReply, setDiscussionReply] = useState<Record<number, string>>({});
  const [isCreatingDiscussion, setIsCreatingDiscussion] = useState(false);

  // Translation Discussion State (from flow system)
  // Maps translation_id to array of discussion messages
  const [translationDiscussions, setTranslationDiscussions] = useState<Record<number, ApiUserActivity[]>>({});

  // Derived display values
  const [displayLabel, setDisplayLabel] = useState('Loading...');
  const [displayDef, setDisplayDef] = useState('Loading...');
  const [displayCategory, setDisplayCategory] = useState('General');

  // Helper to normalize URIs for comparison (remove trailing slashes)
  const normalizeUri = (uri: string) => uri.replace(/\/+$/, '');

  // Fetch user preferences (preferredLanguages, translationLanguages, etc.)
  const fetchUserPreferences = async () => {
    try {
      const res = await backendApi.getUserPreferences();
      if (res) {
        // preferredLanguages: array of language codes (e.g. ["en", "nl"])
        setPreferredLanguages(res.preferredLanguages || []);
        setAllowedLanguages(res.translationLanguages || []);
        // Set default selectedLang to first allowed or preferred
        setSelectedLang((prev) => {
          if (prev && (res.translationLanguages || []).includes(prev)) return prev;
          if ((res.translationLanguages || []).length > 0) return res.translationLanguages[0];
          return '';
        });
      }
    } catch (e) {
      // fallback: no preferences
      setPreferredLanguages([]);
      setAllowedLanguages([]);
    }
  };

  const fetchTermData = async () => {
    setLoading(true);
    // Decode and normalize the ID from URL
    const rawId = decodeURIComponent(id || '');
    const decodedId = normalizeUri(rawId);

    console.log("Searching for term with URI:", decodedId);

    try {
      // 1. Fetch term by URI using paginated search
      const foundApiTerm = await backendApi.getTermByUri(decodedId);

      if (!foundApiTerm) {
        console.error(`Term with URI "${decodedId}" not found in API response.`);
        toast.error("Term not found");
        setLoading(false);
        return;
      }

      setTerm(foundApiTerm);

      // 3. Fetch History
      try {
        const termHistory = await backendApi.getTermHistory(foundApiTerm.id);
        setHistory(termHistory);
        
        // Process translation discussions from history
        const discussionsMap: Record<number, ApiUserActivity[]> = {};
        termHistory.forEach((activity) => {
          if (activity.action === 'translation_discussion' && activity.translation_id) {
            if (!discussionsMap[activity.translation_id]) {
              discussionsMap[activity.translation_id] = [];
            }
            discussionsMap[activity.translation_id].push(activity);
          }
        });
        setTranslationDiscussions(discussionsMap);
      } catch (err) {
        console.warn("Could not fetch term history", err);
      }

      // 4. Fetch Appeals for this specific term
      try {
        const termAppeals = await backendApi.getAppealsByTerm(foundApiTerm.id);
        const appealsMap: Record<number, ApiAppeal[]> = {};

        // Fetch messages for each appeal
        for (const appeal of termAppeals) {
          try {
            const messages = await backendApi.getAppealMessages(appeal.id);
            appeal.messages = messages;
          } catch (e) {
            appeal.messages = [];
          }

          if (!appealsMap[appeal.translation_id]) {
            appealsMap[appeal.translation_id] = [];
          }
          appealsMap[appeal.translation_id].push(appeal);
        }
        setAppeals(appealsMap);
      } catch (err) {
        console.warn("Could not fetch appeals", err);
      }

      // Fetch Discussions for this term
      try {
        const termDiscussions = await backendApi.getTermDiscussions(foundApiTerm.id);
        // Fetch messages for each discussion
        for (const discussion of termDiscussions) {
          try {
            const messages = await backendApi.getDiscussionMessages(discussion.id);
            discussion.messages = messages;
          } catch (e) {
            discussion.messages = [];
          }
        }
        setDiscussions(termDiscussions);
      } catch (err) {
        console.warn("Could not fetch discussions", err);
      }

      // 5. Extract Meta Info
      // Extract display values using field roles
      // Priority: field_role > URI-based detection
      const labelField = foundApiTerm.fields.find(f => f.field_role === 'label')
        || foundApiTerm.fields.find(f => f.field_uri?.includes('prefLabel'));
      const definitionField = foundApiTerm.fields.find(f => f.field_role === 'reference')
        || foundApiTerm.fields.find(f => f.field_uri?.includes('definition'));

      setTerm(foundApiTerm);
      
      // Get user's language priority
      const languagePriority = getLanguagePriority(user?.languagePreferences);
      
      // Get label display value using the same logic as Browse page
      // Filter for original or merged translations only
      const labelTranslations = labelField?.translations.filter(t => 
        t.status === 'original' || t.status === 'merged'
      ) || [];
      
      // Try to get preferred translation based on language priority
      // Empty string as fallback allows us to detect when no translation was found
      let label = getPreferredLabel(labelTranslations, languagePriority, '');
      if (!label) {
        // Fallback chain: original_value -> URI name -> 'Unknown Term'
        label = labelField?.original_value || foundApiTerm.uri.split('/').pop() || 'Unknown Term';
      }
      setDisplayLabel(label);
      
      setDisplayDef(definitionField?.original_value || 'No definition available.');

      const collectionMatch = foundApiTerm.uri.match(/\/collection\/([^/]+)\//);
      setDisplayCategory(collectionMatch ? collectionMatch[1] : 'General');

      // 6. Fetch Permissions
      if (user?.username) {
        try {
          let userLangs: string[] = [];
          const prefs = await backendApi.getUserPreferences().catch(() => null);
          if (prefs?.translationLanguages && Array.isArray(prefs.translationLanguages)) {
            userLangs = prefs.translationLanguages;
          } else if (user.id || user.user_id) {
            const currentUser = await backendApi.getUser(user.id || user.user_id!);
            if (currentUser?.extra) {
              try {
                const extra = JSON.parse(currentUser.extra);
                if (extra.translationLanguages && Array.isArray(extra.translationLanguages)) {
                  userLangs = extra.translationLanguages;
                }
              } catch (e) {
                console.warn("Failed to parse user extra data", e);
              }
            }
          }

          setAllowedLanguages(userLangs);

          if (userLangs.length > 0) {
            setSelectedLang(prev => (userLangs.includes(prev) ? prev : userLangs[0]));
          }
        } catch (error) {
          console.error("Failed to fetch user permissions:", error);
          toast.error("Could not verify your translation permissions.");
        }
      }

    } catch (error) {
      console.error("Error fetching term details:", error);
      toast.error("Failed to load term details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      // Fetch user preferences first, then term data
      fetchUserPreferences().then(() => {
        fetchTermData();
      });
    }
  }, [id, user]);

  // Set form values for the selected language
  useEffect(() => {
    if (term && selectedLang) {
      const newValues: Record<number, string> = {};
      term.fields.forEach(field => {
        const existing = field.translations?.find(t => t.language.toLowerCase() === selectedLang.toLowerCase());
        newValues[field.id] = existing ? existing.value : '';
      });
      setFormValues(newValues);
    }
  }, [term, selectedLang]);

  // Helper: get the best translation for a field based on preferredLanguages
  const getBestTranslation = (field: ApiField): { value: string, language: string, isOriginal: boolean } => {
    // 1. Try to find a translation in preferred languages
    if (field.translations && preferredLanguages.length > 0) {
      for (const lang of preferredLanguages) {
        const t = field.translations.find(tr => tr.language.toLowerCase() === lang.toLowerCase());
        if (t) return { value: t.value, language: t.language, isOriginal: false };
      }
    }
    // 2. Fallback to original value
    // Attempt to determine the language of the original value by checking translations
    const matchingTrans = field.translations?.find(t => t.value === field.original_value);
    // If matching translation found, use its language. Otherwise default to 'en' (or 'undefined' if that's safer, but usually 'en')
    const lang = matchingTrans ? matchingTrans.language : 'en';

    return { value: field.original_value, language: lang, isOriginal: true };
  };

  const handleInputChange = (fieldId: number, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleAiSuggest = async (field: ApiField) => {
    console.log("handleAiSuggest started for field:", field.id);
    if (!selectedLang) {
      console.log("No language selected");
      toast.error("Please select a target language first");
      return;
    }

    if (!apiKey) {
      toast.error("Please configure your OpenRouter API key in Settings");
      return;
    }

    setAiLoading(prev => ({ ...prev, [field.id]: true }));

    try {
      console.log("Fetching models from OpenRouter...");
      // Fetch current free models once
      const modelsResponse = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        }
      });

      if (!modelsResponse.ok) {
        console.error("Failed to fetch models", modelsResponse.status);
        throw new Error("Failed to fetch free models");
      }

      const modelsData = await modelsResponse.json();
      console.log("Models fetched:", modelsData.data?.length);

      const freeModels = modelsData.data.filter((m: any) =>
        m.id.includes(":free")
      );
      console.log("Filtered free models:", freeModels.map((m: any) => m.id));

      if (freeModels.length === 0) {
        console.error("No free models found with ':free' in ID");
        throw new Error("No free models available");
      }

      const type = field.field_uri?.includes('definition') ? 'definition' : 'term';
      const fieldName = field.field_uri?.split('#').pop() || field.field_uri?.split('/').pop() || 'field';
      const prompt = `You are a professional marine scientist and translator.
Translate the following ${type} into ${selectedLang}.
Keep the translation scientific, accurate, and natural.
Do not add explanations, only provide the translation.
Original Text (${fieldName}): "${field.original_value}"`;

      console.log("Prompt prepared:", prompt);

      let suggestion: string | null = null;
      let successfulModel: { id: string; name: string } | null = null;

      // Loop through free models until one succeeds
      for (const model of freeModels) {
        try {
          console.log(`Trying model: ${model.id}`);
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model.id,
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Model ${model.id} response data:`, data);
            const candidateSuggestion = data.choices?.[0]?.message?.content?.trim();
            if (candidateSuggestion) {
              suggestion = candidateSuggestion;
              successfulModel = { id: model.id, name: model.name };
              console.log("Suggestion received:", suggestion);
              break; // Success! Stop looping
            } else {
              console.warn(`Model ${model.id} returned empty content`);
            }
          } else {
            console.warn(`Model ${model.id} response not OK:`, response.status);
          }
        } catch (modelError) {
          console.warn(`Model ${model.id} failed:`, modelError);
          // Continue to next model
        }
      }

      if (suggestion) {
        // Simple cleanup: remove surrounding quotes if present
        const cleanSuggestion = suggestion.replace(/^["']|["']$/g, '');
        console.log("Final clean suggestion:", cleanSuggestion);
        handleInputChange(field.id, cleanSuggestion);
        toast.success(
          `AI suggestion generated using ${successfulModel!.name} (${successfulModel!.id})`
        );
      } else {
        console.error("No suggestion returned from any free model");
        toast.error("No suggestion returned from any free model");
      }
    } catch (error) {
      console.error("AI Suggestion failed", error);
      toast.error("Failed to generate AI suggestion");
    } finally {
      setAiLoading(prev => ({ ...prev, [field.id]: false }));
      console.log("handleAiSuggest finished");
    }
  };

  const submitUpdate = async (targetFieldId?: number, targetStatus?: 'draft' | 'review' | 'approved' | 'rejected' | 'merged', rejectionReason?: string) => {
    if (!term || !user) return;
    setIsSubmitting(true);

    try {
      const updatedFields = term.fields.map(field => {
        const currentLangCode = selectedLang.toLowerCase();
        const newValue = formValues[field.id];

        let translationsPayload = field.translations?.map(t => ({
          language: t.language.toLowerCase(),
          value: t.value,
          status: t.status || 'draft',
          created_by: t.created_by || 'unknown'
        })).filter(t => t.language !== currentLangCode) || [];

        if (newValue && newValue.trim() !== '') {
          const prevTrans = field.translations?.find(t => t.language.toLowerCase() === currentLangCode);

          let newStatus: 'draft' | 'review' | 'approved' | 'rejected' | 'merged' = prevTrans?.status || 'draft';

          if (targetFieldId !== undefined && field.id === targetFieldId && targetStatus) {
            newStatus = targetStatus;
          } else {
            if (prevTrans && prevTrans.value !== newValue) {
              newStatus = 'draft';
            }
          }

          const translationPayload: any = {
            language: currentLangCode,
            value: newValue,
            status: newStatus,
            created_by: prevTrans?.created_by || user.username
          };
          
          // Include rejection_reason if status is rejected and reason is provided
          if (newStatus === 'rejected' && rejectionReason && targetFieldId === field.id) {
            translationPayload.rejection_reason = rejectionReason;
          }
          
          translationsPayload.push(translationPayload);
        }

        return {
          field_uri: field.field_uri,
          field_term: field.field_term,
          original_value: field.original_value,
          translations: translationsPayload
        };
      });

      const payload = {
        uri: term.uri,
        fields: updatedFields,
        token: user.token,
        username: user.username
      };

      await backendApi.updateTerm(term.id, payload);

      let msg = "Changes saved successfully";
      if (targetStatus) {
        if (targetStatus === 'review') msg = "Marked for review";
        if (targetStatus === 'approved') msg = "Translation approved";
        if (targetStatus === 'rejected') msg = "Translation rejected";
      }
      toast.success(msg);

      await fetchTermData();

    } catch (error) {
      console.error("Update failed", error);
      toast.error("Failed to save changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (fieldId: number, newStatus: 'draft' | 'review' | 'approved' | 'rejected' | 'merged', translationId?: number) => {
    if (newStatus === 'rejected') {
      if (!translationId) {
        toast.error("Cannot reject a translation without a valid ID.");
        return;
      }
      setRejectionModal({
        isOpen: true,
        fieldId,
        translationId,
        reason: ''
      });
      return;
    }

    await submitUpdate(fieldId, newStatus);
  };

  const confirmRejection = async () => {
    if (!user || !rejectionModal.translationId || !rejectionModal.fieldId) return;
    
    if (!rejectionModal.reason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);
    try {
      await backendApi.createAppeal({
        translation_id: rejectionModal.translationId,
        opened_by: user.username,
        resolution: rejectionModal.reason || "Rejected by reviewer",
        token: user.token
      });

      await submitUpdate(rejectionModal.fieldId, 'rejected', rejectionModal.reason);

      setRejectionModal(prev => ({ ...prev, isOpen: false, reason: '' }));
      toast.success("Translation rejected and appeal created");
    } catch (error) {
      console.error("Rejection failed", error);
      toast.error("Failed to submit rejection appeal.");
      setIsSubmitting(false);
    }
  };

  const handleReportMessage = (messageId: number) => {
    setReportModal({
      isOpen: true,
      messageId,
      reason: ''
    });
  };

  const confirmReportMessage = async () => {
    if (!reportModal.messageId || !reportModal.reason.trim()) return;

    try {
      await backendApi.reportAppealMessage(reportModal.messageId, reportModal.reason);
      toast.success("Message reported successfully");
      setReportModal({ isOpen: false, messageId: null, reason: '' });
    } catch (error) {
      console.error("Report failed", error);
      toast.error("Failed to report message");
    }
  };

  const handleReplyAppeal = async (appealId: number) => {
    if (!user || !newMessage.trim()) return;
    try {
      await backendApi.createAppealMessage(appealId, {
        author: user.username,
        message: newMessage,
        token: user.token
      });
      setNewMessage('');
      toast.success("Reply sent");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to send reply");
    }
  };

  const handleResolveAppeal = async (appealId: number) => {
    if (!user) return;
    try {
      await backendApi.updateAppeal(appealId, {
        status: 'resolved',
        username: user.username,
        token: user.token
      });
      toast.success("Appeal marked as resolved. Reviewer will verify.");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to resolve appeal");
    }
  };

  const handleCloseAppeal = async (appealId: number) => {
    if (!user) return;
    try {
      await backendApi.updateAppeal(appealId, {
        status: 'closed',
        username: user.username,
        token: user.token
      });
      toast.success("Appeal closed.");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to close appeal");
    }
  };

  // Discussion handlers
  const handleCreateDiscussion = async () => {
    if (!user || !term || !newDiscussionTitle.trim() || !newDiscussionMessage.trim()) {
      toast.error("Please provide both title and message");
      return;
    }
    setIsCreatingDiscussion(true);
    try {
      await backendApi.createTermDiscussion(term.id, {
        title: newDiscussionTitle,
        message: newDiscussionMessage
      });
      setNewDiscussionTitle('');
      setNewDiscussionMessage('');
      toast.success("Discussion created");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to create discussion");
    } finally {
      setIsCreatingDiscussion(false);
    }
  };

  const handleReplyDiscussion = async (discussionId: number) => {
    if (!user || !discussionReply[discussionId]?.trim()) return;
    try {
      await backendApi.createDiscussionMessage(discussionId, {
        message: discussionReply[discussionId]
      });
      setDiscussionReply({ ...discussionReply, [discussionId]: '' });
      toast.success("Reply sent");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to send reply");
    }
  };

  const handleCloseDiscussion = async (discussionId: number) => {
    if (!user) return;
    try {
      await backendApi.updateDiscussion(discussionId, {
        status: 'closed'
      });
      toast.success("Discussion closed");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to close discussion");
    }
  };

  const handleReopenDiscussion = async (discussionId: number) => {
    if (!user) return;
    try {
      await backendApi.updateDiscussion(discussionId, {
        status: 'open'
      });
      toast.success("Discussion reopened");
      await fetchTermData();
    } catch (error) {
      toast.error("Failed to reopen discussion");
    }
  };

  // Handler for joining translation discussions (from flow system)
  const handleJoinTranslationDiscussion = async (translationId: number) => {
    if (!user || !discussionReply[translationId]?.trim()) return;
    
    try {
      // Use the flow review endpoint with 'discuss' action
      await flowApi.submitReview(
        translationId,
        'discuss',
        undefined, // sessionId not needed
        undefined, // rejectionReason not needed
        discussionReply[translationId].trim()
      );
      
      // Clear the input
      setDiscussionReply({ ...discussionReply, [translationId]: '' });
      toast.success("Message added to discussion");
      
      // Refresh the term data to show the new message
      await fetchTermData();
    } catch (error) {
      console.error("Failed to join translation discussion:", error);
      toast.error("Failed to add message to discussion");
    }
  };


  const toggleHistory = (fieldId: number) => {
    setOpenAppealFieldId(null);
    if (openHistoryFieldId === fieldId) {
      setOpenHistoryFieldId(null);
      setSelectedHistoryEventId(null);
    } else {
      setOpenHistoryFieldId(fieldId);
      setSelectedHistoryEventId(null);
    }
  };

  const toggleAppeal = (fieldId: number) => {
    setOpenHistoryFieldId(null);
    if (openAppealFieldId === fieldId) {
      setOpenAppealFieldId(null);
    } else {
      setOpenAppealFieldId(fieldId);
    }
  }

  const parseExtra = (extra: string | null) => {
    try {
      return extra ? JSON.parse(extra) : {};
    } catch { return {}; }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500 border-green-200';
      case 'review': return 'bg-amber-500 border-amber-200';
      case 'rejected': return 'bg-red-500 border-red-200';
      case 'merged': return 'bg-purple-500 border-purple-200';
      default: return 'bg-slate-400 border-slate-200';
    }
  };

  const getBaseColorName = (activity: any, parsedExtra: any) => {
    if (activity.action === 'translation_status_changed' && parsedExtra.new_status) {
      switch (parsedExtra.new_status) {
        case 'approved': return 'green-500';
        case 'review': return 'amber-500';
        case 'rejected': return 'red-500';
        case 'merged': return 'purple-500';
        default: return 'slate-400';
      }
    }
    if (activity.action === 'translation_created') return 'blue-500';
    if (activity.action === 'translation_edited') return 'blue-400';
    return 'slate-300';
  };

  const getColorHex = (name: string) => {
    const colors: Record<string, string> = {
      'green-500': '#22c55e',
      'amber-500': '#f59e0b',
      'red-500': '#ef4444',
      'purple-500': '#a855f7',
      'slate-300': '#cbd5e1',
      'slate-400': '#94a3b8',
      'blue-500': '#3b82f6',
      'blue-400': '#60a5fa'
    };
    return colors[name] || '#cbd5e1';
  };

  const getEventDotColor = (activity: any, parsedExtra: any) => {
    if (activity.action === 'translation_status_changed' && parsedExtra.new_status) {
      return getStatusColor(parsedExtra.new_status);
    }
    if (activity.action === 'translation_created') return 'bg-blue-500 border-blue-200';
    if (activity.action === 'translation_edited') return 'bg-blue-400 border-blue-200';
    return 'bg-slate-300 border-slate-100';
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-8"></div>
        <div className="h-10 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
        <div className="h-20 w-full bg-slate-200 dark:bg-slate-700 rounded mb-8"></div>
      </div>
    );
  }

  if (!term) return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-center">
      <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Term not found</h2>
      <Link to="/browse" className="text-marine-600 hover:underline mt-4 inline-block">Return to Browse</Link>
    </div>
  );

  const canTranslate = allowedLanguages.length > 0;


  // Helper: parse field_roles string to array, fallback to field_role if not present
  const getFieldRoles = (field: ApiField): string[] => {
    // If backend sends field_roles (stringified array), parse it
    if ((field as any).field_roles) {
      const raw = (field as any).field_roles;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return [];
        }
      }
      if (Array.isArray(raw)) return raw;
    }
    // Fallback: use field_role if present
    if (field.field_role) return [field.field_role];
    return [];
  };

  // Filter fields: only show those for which the user has a language preference set
  const translatableFields = term.fields.filter(f => {
    const roles = getFieldRoles(f);
    // Only show if at least one preferred language is present in translations or allowedLanguages
    const hasPreferred = preferredLanguages.some(lang =>
      f.translations?.some(t => t.language.toLowerCase() === lang.toLowerCase())
    );
    // Also show if user can translate into this language (for input)
    const canTranslateAny = allowedLanguages.some(lang =>
      !f.translations?.some(t => t.language.toLowerCase() === lang.toLowerCase())
    );
    // Only show fields that match the original filter (translatable/label/reference/definition)
    const isTranslatableType = f.original_value && (
      roles.includes('translatable') || roles.includes('label') || roles.includes('reference')
    );
    return isTranslatableType && (hasPreferred || canTranslateAny);
  });

  console.log("Translatable fields:", translatableFields);


  const getFieldIcon = (uri: string, roles: string[]) => {
    if (roles.includes('label') || uri.includes('prefLabel')) return <Tag size={16} className="text-blue-500" />;
    if (uri.includes('altLabel')) return <Tag size={16} className="text-amber-500" />;
    if (roles.includes('reference') || uri.includes('definition')) return <AlignLeft size={16} className="text-green-500" />;
    return <Globe size={16} />;
  };

  const getFieldLabel = (uri: string, roles: string[]) => {
    if (roles.includes('label') || uri.includes('prefLabel')) return 'Preferred Label';
    if (uri.includes('altLabel')) return 'Alternative Label';
    if (roles.includes('reference') || uri.includes('definition')) return 'Definition';
    return uri.split('#').pop() || uri.split('/').pop() || 'Other Field';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Rejection Modal */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <XCircle size={24} />
              </div>
              <h3 className="text-xl font-bold">Reject Translation</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-4 text-sm">
              Please provide a reason for rejecting this translation. This will open an appeal ticket for the author.
            </p>
            <textarea
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white p-3 mb-4 focus:ring-red-500 focus:border-red-500"
              rows={4}
              placeholder="Reason for rejection (e.g., incorrect terminology, grammar issues)..."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal(prev => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectionModal(prev => ({ ...prev, isOpen: false, reason: '' }))}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmRejection}
                disabled={isSubmitting || !rejectionModal.reason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Message Modal */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Flag size={24} />
              </div>
              <h3 className="text-xl font-bold">Report Message</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-4 text-sm">
              Please provide a reason for reporting this message. An admin will review your report.
            </p>
            <textarea
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white p-3 mb-4 focus:ring-red-500 focus:border-red-500"
              rows={4}
              placeholder="Reason for reporting (e.g., harassment, spam, inappropriate content)..."
              value={reportModal.reason}
              onChange={(e) => setReportModal(prev => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReportModal({ isOpen: false, messageId: null, reason: '' })}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmReportMessage}
                disabled={!reportModal.reason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/browse" className="inline-flex items-center text-slate-500 hover:text-marine-600 mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Back to Browse
      </Link>

      <div className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-marine-100 dark:bg-marine-900 text-marine-700 dark:text-marine-300 mb-3">
          {displayCategory}
        </span>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{displayLabel}</h1>
        <a href={term.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-slate-400 hover:text-marine-600 transition-colors max-w-full min-w-0" title={term.uri}>
          <span className="truncate max-w-[calc(100vw-3.5rem)] md:max-w-xl">{term.uri}</span>
          <ExternalLink size={12} className="ml-1 flex-shrink-0" />
        </a>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Context Column */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 sticky top-24">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookOpen size={16} /> Reference Definition
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-serif text-lg">
              {displayDef}
            </p>
          </div>
        </div>

        {/* Workspace Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Bar with Language Selection */}
          <div data-tour="add-translation-btn" className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe size={20} className="text-marine-500" /> Translation Workspace
              </h2>
              <div className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full">
                Select a language to edit:
              </div>
            </div>

            {allowedLanguages.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 flex flex-col items-center justify-center">
                <Lock size={32} className="mb-3 text-slate-300" />
                <p>You do not have permissions to translate this term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allowedLanguages.map(lang => {
                  // Count statuses for progress bar
                  const counts = {
                    approved: 0,
                    review: 0,
                    rejected: 0,
                    merged: 0,
                    original: 0,
                    draft: 0
                  };
                  let totalFields = 0;
                  let translatedFields = 0;

                  translatableFields.forEach(field => {
                    totalFields++;
                    const t = field.translations?.find(tr => tr.language.toLowerCase() === lang.toLowerCase());
                    if (t) {
                      translatedFields++;
                      const s = (t.status || 'draft') as keyof typeof counts;
                      if (counts[s] !== undefined) counts[s]++;
                      else counts.draft++; // Default to draft if unknown
                    }
                  });

                  const isComplete = translatedFields === totalFields;
                  const hasDraft = counts.draft > 0;
                  const hasReview = counts.review > 0;
                  const hasApproved = counts.approved > 0;
                  const hasOriginal = counts.original > 0;
                  const hasRejected = counts.rejected > 0;

                  const isSelected = selectedLang === lang;

                  return (
                    <button
                      key={lang}
                      onClick={() => setSelectedLang(lang)}
                      className={`
                                  relative flex flex-col items-start p-3 rounded-xl border transition-all text-left group
                                  ${isSelected
                          ? 'bg-marine-50 dark:bg-marine-900/20 border-marine-500 ring-1 ring-marine-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-marine-300 dark:hover:border-marine-700 hover:shadow-md'
                        }
                               `}
                    >
                      <div className="flex justify-between items-center w-full mb-2">
                        <span className={`text-lg font-bold ${isSelected ? 'text-marine-700 dark:text-marine-300' : 'text-slate-700 dark:text-slate-300'}`}>
                          {lang.toUpperCase()}
                        </span>
                        {isSelected && <CheckCircle size={16} className="text-marine-600" />}
                        {!isSelected && isComplete && <CheckCircle size={16} className="text-green-500 opacity-50" />}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap min-h-[20px]">
                        {/* Status Indicators */}
                        {translatedFields === 0 && (
                          <span title="No translations yet" className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                            <PlusCircle size={10} className="mr-1" /> Start
                          </span>
                        )}

                        {/* Show icons for mixed statuses */}
                        {hasDraft && <span title="Has Drafts" className="text-slate-500 bg-slate-100 dark:bg-slate-700 p-0.5 rounded"><Edit3 size={12} /></span>}
                        {hasReview && <span title="In Review" className="text-amber-600 bg-amber-50 dark:bg-amber-900/30 p-0.5 rounded"><Clock size={12} /></span>}
                        {hasApproved && <span title="Has Approved" className="text-green-600 bg-green-50 dark:bg-green-900/30 p-0.5 rounded"><CheckCircle size={12} /></span>}
                        {hasOriginal && <span title="Original (Done)" className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 p-0.5 rounded"><CheckSquare size={12} /></span>}
                        {hasRejected && <span title="Has Rejected" className="text-red-500 bg-red-50 dark:bg-red-900/30 p-0.5 rounded"><XCircle size={12} /></span>}

                        {/* Missing translations indicator */}
                        {!isComplete && (
                          <span title={`${totalFields - translatedFields} fields need translation`} className="text-marine-500 flex items-center gap-0.5 text-[10px] font-medium ml-auto">
                            <AlertCircle size={12} />
                          </span>
                        )}
                      </div>

                      {/* Segmented Progress Bar */}
                      <div className="w-full h-1.5 flex rounded-full mt-3 overflow-hidden bg-slate-100 dark:bg-slate-700">
                        {counts.approved > 0 && <div className="h-full bg-green-500" style={{ width: `${(counts.approved / totalFields) * 100}%` }} title="Approved" />}
                        {counts.original > 0 && <div className="h-full bg-blue-500" style={{ width: `${(counts.original / totalFields) * 100}%` }} title="Original (Done)" />}
                        {counts.review > 0 && <div className="h-full bg-amber-500" style={{ width: `${(counts.review / totalFields) * 100}%` }} title="Review" />}
                        {counts.draft > 0 && <div className="h-full bg-slate-400" style={{ width: `${(counts.draft / totalFields) * 100}%` }} title="Draft" />}
                        {counts.rejected > 0 && <div className="h-full bg-red-500" style={{ width: `${(counts.rejected / totalFields) * 100}%` }} title="Rejected" />}
                        {counts.merged > 0 && <div className="h-full bg-purple-500" style={{ width: `${(counts.merged / totalFields) * 100}%` }} title="Merged" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fields Loop */}
          {translatableFields.map(field => {
            const roles = getFieldRoles(field);
            const label = getFieldLabel(field.field_uri, roles);
            const isTextArea = roles.includes('reference') || field.field_uri?.includes('definition');
            const currentTranslation = field.translations?.find(t => t.language.toLowerCase() === selectedLang.toLowerCase());
            const status = currentTranslation?.status || 'draft';
            // Check if this is the current user's translation using user_id
            const isMyTranslation = currentTranslation?.created_by_id === (user?.id || user?.user_id);
            const hasValue = formValues[field.id] && formValues[field.id].trim().length > 0;
            const translationId = currentTranslation?.id;

            const isHistoryOpen = openHistoryFieldId === field.id;
            const isAppealOpen = openAppealFieldId === field.id;

            const fieldAppeals = translationId ? (appeals[translationId] || []) : [];
            const activeAppeals = fieldAppeals.filter(a => a.status !== 'closed');
            const hasActiveAppeal = activeAppeals.length > 0;

            const fieldHistoryRaw = history
              .map(h => ({ ...h, parsedExtra: parseExtra(h.extra) }))
              .filter(h =>
                h.parsedExtra?.field_uri === field.field_uri &&
                h.parsedExtra?.language?.toLowerCase() === selectedLang.toLowerCase()
              )
              .sort((a, b) => parse(b.created_at).valueOf() - parse(a.created_at).valueOf());

            const useHorizontalTimeline = fieldHistoryRaw.length > 3;
            const selectedEvent = selectedHistoryEventId
              ? fieldHistoryRaw.find(h => h.id === selectedHistoryEventId)
              : fieldHistoryRaw[0];

            return (
              <div key={field.id} className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden shadow-sm transition-colors ${hasActiveAppeal ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-700'}`}>
                {/* Field Header */}
                <div className="bg-slate-50 dark:bg-slate-900/40 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {getFieldIcon(field.field_uri, roles)}
                    <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
                    {hasActiveAppeal && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 animate-pulse">
                        <AlertTriangle size={12} className="mr-1" /> Changes Requested
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const best = getBestTranslation(field);
                      return <>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">{best.language.toUpperCase()}</span>
                        <span className="text-xs text-slate-400">{!best.isOriginal ? 'Preferred' : 'Original'}</span>
                      </>;
                    })()}
                  </div>
                </div>

                <div className="p-6">
                  {/* Best Translation or Original Value */}
                  <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 italic">
                    {(() => {
                      const best = getBestTranslation(field);
                      return `"${best.value}"`;
                    })()}
                  </div>

                  {/* Input Area */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex justify-between items-center">
                      <span>{selectedLang} Translation</span>
                      <div className="flex items-center gap-2">
                        {canTranslate && hasApiKey && !isLoadingApiKey && (
                          <button
                            type="button"
                            onClick={() => handleAiSuggest(field)}
                            disabled={aiLoading[field.id] || status === 'original' || status === 'merged'}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                            title="Generate AI Suggestion"
                          >
                            {aiLoading[field.id] ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            AI Suggest
                          </button>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize
                                    ${status === 'approved' ? 'bg-green-100 text-green-700' :
                            status === 'rejected' ? 'bg-red-100 text-red-700' :
                              status === 'rejected' ? 'bg-red-100 text-red-700' :
                                status === 'original' ? 'bg-blue-100 text-blue-700' :
                                  status === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                                    `}
                        >
                          Status: {status}
                        </span>
                      </div>
                    </label>

                    {isTextArea ? (
                      <textarea
                        rows={4}
                        className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:border-marine-500 focus:ring-marine-500 sm:text-sm p-3"
                        value={formValues[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        disabled={!canTranslate || currentTranslation?.status === 'original' || currentTranslation?.status === 'merged'}
                        placeholder="Enter translation..."
                      />
                    ) : (
                      <input
                        type="text"
                        className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:border-marine-500 focus:ring-marine-500 sm:text-sm p-3"
                        value={formValues[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        disabled={!canTranslate || currentTranslation?.status === 'original' || currentTranslation?.status === 'merged'}
                        placeholder="Enter translation..."
                      />
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleHistory(field.id)}
                        className="text-xs text-slate-500 hover:text-marine-600 flex items-center gap-1 transition-colors"
                      >
                        <History size={14} /> {isHistoryOpen ? 'Hide' : 'View'} History
                      </button>
                      {(fieldAppeals.length > 0) && (
                        <button
                          onClick={() => toggleAppeal(field.id)}
                          className={`text-xs flex items-center gap-1 transition-colors ${hasActiveAppeal ? 'text-red-500 font-bold' : 'text-slate-500 hover:text-marine-600'}`}
                        >
                          <MessageSquare size={14} />
                          {isAppealOpen ? 'Hide' : 'View'} Appeals ({fieldAppeals.length})
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {status === 'draft' && isMyTranslation && hasValue && (
                        <button
                          onClick={() => handleStatusChange(field.id, 'review')}
                          disabled={isSubmitting}
                          className="flex items-center px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-xs font-medium transition-colors"
                        >
                          <Clock size={14} className="mr-1" /> Mark for Review
                        </button>
                      )}

                      {status === 'review' && !isMyTranslation && (
                        <>
                          <button
                            onClick={() => handleStatusChange(field.id, 'rejected', translationId)}
                            disabled={isSubmitting}
                            className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors"
                          >
                            <XCircle size={14} className="mr-1" /> Reject
                          </button>
                          <button
                            onClick={() => handleStatusChange(field.id, 'approved')}
                            disabled={isSubmitting}
                            className="flex items-center px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors"
                          >
                            <CheckCircle size={14} className="mr-1" /> Approve
                          </button>
                        </>
                      )}

                      <button
                        onClick={(e) => { e.preventDefault(); submitUpdate(); }}
                        disabled={isSubmitting || !canTranslate || status === 'original' || status === 'merged'}
                        className="flex items-center px-4 py-2 bg-marine-600 text-white hover:bg-marine-700 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={14} className="mr-2" /> Save Draft
                      </button>
                    </div>
                  </div>

                  {/* Appeals / Disputes Section */}
                  {isAppealOpen && (
                    <div className="mt-6 bg-red-50 dark:bg-slate-900/50 rounded-lg p-4 border border-red-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                      <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-3 flex items-center gap-1">
                        <MessageSquare size={12} /> Appeals & Disputes
                      </h4>
                      <div className="space-y-4">
                        {fieldAppeals.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">No appeals filed.</p>
                        ) : (
                          fieldAppeals.map(appeal => (
                            <div key={appeal.id} className="bg-white dark:bg-slate-800 rounded border border-red-100 dark:border-slate-700 p-3 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize mb-1 ${appeal.status === 'open' ? 'bg-red-100 text-red-800' :
                                    appeal.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {appeal.status}
                                  </span>
                                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {appeal.resolution}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Opened by {appeal.opened_by} on {format(parse(appeal.opened_at), 'YYYY-MM-DD')}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {appeal.status === 'open' && (
                                    <button
                                      onClick={() => handleResolveAppeal(appeal.id)}
                                      className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded hover:bg-green-100 border border-green-200 flex items-center"
                                    >
                                      <CheckSquare size={12} className="mr-1" /> Mark Resolved
                                    </button>
                                  )}
                                  {appeal.status === 'resolved' && appeal.opened_by === user?.username && (
                                    <button
                                      onClick={() => handleCloseAppeal(appeal.id)}
                                      className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 border border-slate-300 flex items-center"
                                    >
                                      <XCircle size={12} className="mr-1" /> Close Appeal
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                                {appeal.messages?.map(msg => (
                                  <div key={msg.id} className="text-sm bg-white dark:bg-slate-800 p-2 rounded">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{msg.author}</span>
                                        <span className="text-xs text-slate-400">{format(parse(msg.created_at), 'YYYY-MM-DD')}</span>
                                      </div>
                                      {user && (
                                        <button
                                          onClick={() => handleReportMessage(msg.id)}
                                          className="text-red-500 hover:text-red-700 p-1"
                                          title="Report this message"
                                        >
                                          <Flag size={12} />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 mt-1">{msg.message}</p>
                                  </div>
                                ))}
                              </div>

                              {appeal.status !== 'closed' && (
                                <div className="mt-3 flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Reply to this appeal..."
                                    className="flex-grow text-sm rounded border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-50 dark:bg-slate-900"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleReplyAppeal(appeal.id); }}
                                  />
                                  <button
                                    onClick={() => handleReplyAppeal(appeal.id)}
                                    className="p-1.5 bg-marine-600 text-white rounded hover:bg-marine-700"
                                  >
                                    <Send size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline Section */}
                  {isHistoryOpen && (
                    <div className="mt-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
                        <History size={12} /> Timeline for {label} ({selectedLang})
                      </h4>

                      {fieldHistoryRaw.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No recorded history.</p>
                      ) : useHorizontalTimeline ? (
                        // Horizontal Timeline (>3 items)
                        <div>
                          <div className="relative pt-2 pb-6 px-4 overflow-x-auto">
                            <div className="flex items-start min-w-max">
                              {fieldHistoryRaw.map((h, idx) => {
                                const extra = h.parsedExtra;
                                const dotColor = getEventDotColor(h, extra);
                                const isSelected = selectedEvent && selectedEvent.id === h.id;
                                const nextH = fieldHistoryRaw[idx + 1];

                                const color1Name = getBaseColorName(h, extra);
                                const color2Name = nextH ? getBaseColorName(nextH, nextH.parsedExtra) : 'slate-300';

                                const color1Hex = getColorHex(color1Name);
                                const color2Hex = getColorHex(color2Name);

                                return (
                                  <div key={h.id} className="flex items-center">
                                    <div className="flex flex-col items-center cursor-pointer group w-20" onClick={() => setSelectedHistoryEventId(h.id)}>
                                      <div className={`w-4 h-4 rounded-full border-2 transition-all z-10 ${dotColor} ${isSelected ? 'ring-2 ring-marine-500 scale-125' : 'group-hover:scale-110'}`}></div>
                                      <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">{format(parse(h.created_at), 'MMM D')}</span>
                                    </div>
                                    {nextH && (
                                      <div
                                        className="h-0.5 w-12 rounded-full mx-0.5"
                                        style={{ background: `linear-gradient(to right, ${color1Hex}, ${color2Hex})` }}
                                      ></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Selected Event Details */}
                          {selectedEvent && (
                            <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-3 mt-2 text-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{selectedEvent.user}</span>
                                <span className="text-xs text-slate-400">{format(parse(selectedEvent.created_at), 'YYYY-MM-DD HH:mm:ss')}</span>
                              </div>
                              <div className="text-xs text-slate-500 mb-2 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded inline-block">
                                {selectedEvent.action.replace(/_/g, ' ')}
                              </div>

                              <div className="space-y-1">
                                {selectedEvent.parsedExtra.old_status && selectedEvent.parsedExtra.new_status && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700`}>{selectedEvent.parsedExtra.old_status}</span>
                                    <ChevronRight size={12} className="text-slate-400" />
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${getStatusColor(selectedEvent.parsedExtra.new_status).split(' ')[0]} text-white`}>
                                      {selectedEvent.parsedExtra.new_status}
                                    </span>
                                  </div>
                                )}
                                {selectedEvent.parsedExtra.old_value && selectedEvent.parsedExtra.new_value && (
                                  <div className="text-xs mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                                    <div className="text-red-500 line-through opacity-70 mb-1">"{selectedEvent.parsedExtra.old_value}"</div>
                                    <div className="text-green-600 dark:text-green-400">"{selectedEvent.parsedExtra.new_value}"</div>
                                  </div>
                                )}
                                {selectedEvent.parsedExtra.value && !selectedEvent.parsedExtra.old_value && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400 italic">
                                    "{selectedEvent.parsedExtra.value}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Vertical Timeline (<=3 items)
                        <div className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-4 pl-4">
                          {fieldHistoryRaw.map(h => {
                            const extra = h.parsedExtra;
                            return (
                              <div key={h.id} className="relative">
                                <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${getEventDotColor(h, extra).split(' ')[0]}`}></div>
                                <div className="text-xs">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{h.user}</span>
                                  <span className="text-slate-500 ml-1">{h.action.replace(/_/g, ' ')}</span>
                                </div>

                                {/* Simple Inline Details for Vertical View */}
                                {extra.new_status && (
                                  <div className="text-[10px] mt-0.5">
                                    Changed status to <span className="font-bold">{extra.new_status}</span>
                                  </div>
                                )}
                                {(extra.value || extra.new_value) && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5 bg-white dark:bg-slate-800 inline-block px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                                    "{extra.value || extra.new_value}"
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400 mt-1">{format(parse(h.created_at), 'YYYY-MM-DD HH:mm:ss')}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Term-Level Discussions Section */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageCircle size={20} className="text-marine-500" />
                Discussions ({discussions.length + Object.keys(translationDiscussions).length})
              </h3>
              <button
                onClick={() => setShowDiscussions(!showDiscussions)}
                className="text-sm text-marine-600 hover:text-marine-700 font-medium"
              >
                {showDiscussions ? 'Hide' : 'Show'}
              </button>
            </div>

            {showDiscussions && (
              <div className="space-y-4">
                {/* Create New Discussion */}
                {user && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Start a New Discussion
                    </h4>
                    <input
                      type="text"
                      placeholder="Discussion title..."
                      value={newDiscussionTitle}
                      onChange={(e) => setNewDiscussionTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <textarea
                      placeholder="What would you like to discuss about this term?"
                      value={newDiscussionMessage}
                      onChange={(e) => setNewDiscussionMessage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      rows={3}
                    />
                    <button
                      onClick={handleCreateDiscussion}
                      disabled={isCreatingDiscussion || !newDiscussionTitle.trim() || !newDiscussionMessage.trim()}
                      className="px-4 py-2 bg-marine-600 text-white rounded-lg hover:bg-marine-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <PlusCircle size={16} />
                      {isCreatingDiscussion ? 'Creating...' : 'Create Discussion'}
                    </button>
                  </div>
                )}

                {/* Discussion Lists */}
                {discussions.length === 0 && Object.keys(translationDiscussions).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageCircle size={48} className="mx-auto mb-2 opacity-20" />
                    <p>No discussions yet. Be the first to start one!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Translation-Level Discussions (from Flow) */}
                    {Object.keys(translationDiscussions).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                          <MessageSquare size={14} />
                          Translation Discussions ({Object.keys(translationDiscussions).length})
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(translationDiscussions).map(([translationId, messages]) => {
                            // Find the translation to get field and language info
                            const translation = term?.fields
                              .flatMap(f => f.translations || [])
                              .find(t => t.id === parseInt(translationId));
                            
                            if (!translation) return null;
                            
                            // Hide discussions for approved or merged translations
                            if (translation.status === 'approved' || translation.status === 'merged') {
                              return null;
                            }
                            
                            // Find the field this translation belongs to
                            const field = term?.fields.find(f => 
                              f.translations?.some(t => t.id === parseInt(translationId))
                            );
                            
                            const fieldLabel = field?.original_value || 'Unknown field';
                            const language = translation.language.toUpperCase();
                            const translationIdNum = parseInt(translationId);
                            
                            return (
                              <div
                                key={translationId}
                                className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded">
                                        {language}
                                      </span>
                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Translation: {fieldLabel}
                                      </span>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        translation.status === 'discussion' 
                                          ? 'bg-orange-100 text-orange-800' 
                                          : 'bg-slate-100 text-slate-800'
                                      }`}>
                                        {translation.status}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {messages.length} message{messages.length !== 1 ? 's' : ''} in discussion
                                    </div>
                                  </div>
                                </div>

                                {/* Discussion Messages */}
                                <div className="space-y-2 ml-3 pl-3 border-l-2 border-amber-300 dark:border-amber-700">
                                  {messages.map((msg) => {
                                    let discussionMessage = '';
                                    try {
                                      const extra = JSON.parse(msg.extra || '{}');
                                      discussionMessage = extra.discussion_message || '';
                                    } catch (e) {
                                      discussionMessage = '';
                                    }
                                    
                                    return (
                                      <div key={msg.id} className="text-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {msg.user || `User ${msg.user_id}`}
                                          </span>
                                          <span className="text-xs text-slate-400">
                                            {format(parse(msg.created_at), 'YYYY-MM-DD HH:mm')}
                                          </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400">{discussionMessage}</p>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Join Discussion Input */}
                                {user && translation.status === 'discussion' && (
                                  <div className="mt-3 flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Add your message to this discussion..."
                                      value={discussionReply[translationIdNum] || ''}
                                      onChange={(e) =>
                                        setDiscussionReply({
                                          ...discussionReply,
                                          [translationIdNum]: e.target.value,
                                        })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && discussionReply[translationIdNum]?.trim()) {
                                          handleJoinTranslationDiscussion(translationIdNum);
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                    />
                                    <button
                                      onClick={() => handleJoinTranslationDiscussion(translationIdNum)}
                                      disabled={!discussionReply[translationIdNum]?.trim()}
                                      className="p-2 bg-marine-600 text-white rounded-lg hover:bg-marine-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Join discussion"
                                    >
                                      <Send size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Term-Level Discussions */}
                    {discussions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                          <MessageCircle size={14} />
                          General Term Discussions ({discussions.length})
                        </h4>
                        <div className="space-y-3">
                          {discussions.map((discussion) => (
                    <div
                      key={discussion.id}
                      className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-md font-bold text-slate-900 dark:text-white mb-1">
                            {discussion.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Started by {discussion.started_by}</span>
                            <span>•</span>
                            <span>{format(parse(discussion.created_at), 'YYYY-MM-DD')}</span>
                            {discussion.message_count && discussion.message_count > 0 && (
                              <>
                                <span>•</span>
                                <span>{discussion.message_count} message{discussion.message_count !== 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              discussion.status === 'open'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {discussion.status}
                          </span>
                          {user && discussion.started_by === user.username && (
                            <button
                              onClick={() =>
                                discussion.status === 'open'
                                  ? handleCloseDiscussion(discussion.id)
                                  : handleReopenDiscussion(discussion.id)
                              }
                              className="text-xs text-slate-500 hover:text-marine-600"
                            >
                              {discussion.status === 'open' ? 'Close' : 'Reopen'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Discussion Messages */}
                      <div className="space-y-2 ml-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                        {discussion.messages?.map((msg) => (
                          <div key={msg.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {msg.author}
                              </span>
                              <span className="text-xs text-slate-400">
                                {format(parse(msg.created_at), 'YYYY-MM-DD HH:mm')}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400">{msg.message}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply Input */}
                      {user && discussion.status === 'open' && (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="Reply to this discussion..."
                            value={discussionReply[discussion.id] || ''}
                            onChange={(e) =>
                              setDiscussionReply({
                                ...discussionReply,
                                [discussion.id]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleReplyDiscussion(discussion.id);
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                          />
                          <button
                            onClick={() => handleReplyDiscussion(discussion.id)}
                            disabled={!discussionReply[discussion.id]?.trim()}
                            className="p-2 bg-marine-600 text-white rounded-lg hover:bg-marine-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermDetail;
