
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Globe, Save, Shield, Settings as SettingsIcon, Plus, X, ChevronUp, ChevronDown, Search, Key, Eye, EyeOff, Sparkles, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { CONFIG } from '../config';
import { backendApi } from '../services/api';

interface UserPreferences {
  nativeLanguage?: string;
  translationLanguages?: string[];
  preferredLanguages?: string[];
}

interface Language {
  code: string;
  name: string;
  native_name: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [orderedLanguages, setOrderedLanguages] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddLanguageModal, setShowAddLanguageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // OpenRouter API Key states
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);

  // Email notification preferences states
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailOnDiscussion, setEmailOnDiscussion] = useState(true);
  const [emailOnStatusChange, setEmailOnStatusChange] = useState(true);
  const [emailDigestFrequency, setEmailDigestFrequency] = useState('none');
  const [isLoadingEmailPrefs, setIsLoadingEmailPrefs] = useState(true);
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false);
  const [emailPrefsChanged, setEmailPrefsChanged] = useState(false);

  // Load email preferences
  useEffect(() => {
    const loadEmailPreferences = async () => {
      try {
        const response = await fetch(`${CONFIG.API_URL}/user/preferences/email`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setUserEmail(data.email);
          setEmailOnDiscussion(data.emailOnDiscussion);
          setEmailOnStatusChange(data.emailOnStatusChange);
          setEmailDigestFrequency(data.emailDigestFrequency);
        }
      } catch (error) {
        console.error('Failed to load email preferences:', error);
      } finally {
        setIsLoadingEmailPrefs(false);
      }
    };

    loadEmailPreferences();
  }, []);

  const handleSaveEmailPrefs = async () => {
    setIsSavingEmailPrefs(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/user/preferences/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailOnDiscussion,
          emailOnStatusChange,
          emailDigestFrequency
        })
      });

      if (response.ok) {
        toast.success('Email preferences saved successfully!');
        setEmailPrefsChanged(false);
      } else {
        throw new Error('Failed to save email preferences');
      }
    } catch (error) {
      console.error('Error saving email preferences:', error);
      toast.error('Failed to save email preferences. Please try again.');
    } finally {
      setIsSavingEmailPrefs(false);
    }
  };

  // Load available languages from API
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch(`${CONFIG.API_URL}/languages`);
        if (response.ok) {
          const languages = await response.json();
          setAvailableLanguages(languages);
        } else {
          console.error('Failed to load languages from API');
          // Keep empty array if API fails
        }
      } catch (error) {
        console.error('Failed to load languages:', error);
        // Keep empty array if API fails
      } finally {
        setIsLoadingLanguages(false);
      }
    };

    loadLanguages();
  }, []);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch(`${CONFIG.API_URL}/user/preferences`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          // Build ordered languages from preferredLanguages or fallback to legacy format
          const languages: string[] = [];
          
          if (data.preferredLanguages && Array.isArray(data.preferredLanguages) && data.preferredLanguages.length > 0) {
            // Use new preferred languages format (already ordered)
            languages.push(...data.preferredLanguages);
          } else {
            // Fallback to legacy format: native language first, then translation languages
            if (data.nativeLanguage) {
              languages.push(data.nativeLanguage);
            }
            if (data.translationLanguages && Array.isArray(data.translationLanguages)) {
              // Add translation languages that aren't already in the list
              data.translationLanguages.forEach((lang: string) => {
                if (!languages.includes(lang)) {
                  languages.push(lang);
                }
              });
            }
          }
          
          setOrderedLanguages(languages);
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Load OpenRouter API key status
  useEffect(() => {
    const loadApiKeyStatus = async () => {
      try {
        const response = await backendApi.hasOpenRouterApiKey();
        setHasApiKey(response.hasApiKey);
      } catch (error) {
        console.error('Failed to load API key status:', error);
      } finally {
        setIsLoadingApiKey(false);
      }
    };

    loadApiKeyStatus();
  }, []);

  const handleSaveApiKey = async () => {
    if (!openRouterApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsSavingApiKey(true);
    try {
      await backendApi.saveOpenRouterApiKey(openRouterApiKey.trim());
      toast.success('OpenRouter API key saved successfully!');
      setHasApiKey(true);
      setApiKeyChanged(false);
      setOpenRouterApiKey(''); // Clear the input for security
      setShowApiKey(false);
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Failed to save API key. Please try again.');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm('Are you sure you want to delete your OpenRouter API key? AI translation features will no longer be available.')) {
      return;
    }

    setIsSavingApiKey(true);
    try {
      await backendApi.deleteOpenRouterApiKey();
      toast.success('OpenRouter API key deleted successfully');
      setHasApiKey(false);
      setOpenRouterApiKey('');
      setApiKeyChanged(false);
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key. Please try again.');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleAddLanguage = (langCode: string) => {
    if (!orderedLanguages.includes(langCode)) {
      setOrderedLanguages([...orderedLanguages, langCode]);
      setHasUnsavedChanges(true);
      setShowAddLanguageModal(false);
      setSearchQuery('');
    }
  };

  const handleRemoveLanguage = (langCode: string) => {
    setOrderedLanguages(orderedLanguages.filter(l => l !== langCode));
    setHasUnsavedChanges(true);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...orderedLanguages];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setOrderedLanguages(newOrder);
      setHasUnsavedChanges(true);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < orderedLanguages.length - 1) {
      const newOrder = [...orderedLanguages];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setOrderedLanguages(newOrder);
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // First language is native, all languages (including native) are translatable
      const nativeLanguage = orderedLanguages[0] || '';
      const translationLanguages = orderedLanguages; // All selected languages are translatable
      
      const response = await fetch(`${CONFIG.API_URL}/user/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nativeLanguage,
          translationLanguages,
          preferredLanguages: orderedLanguages // Send the full ordered list
        })
      });

      if (response.ok) {
        toast.success('Preferences saved successfully!');
        setHasUnsavedChanges(false);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguageName = (code: string) => {
    const lang = availableLanguages.find(l => l.code === code);
    return lang ? `${lang.name} (${lang.native_name})` : code;
  };

  // Filter available languages for the add modal
  const filteredLanguages = availableLanguages.filter(lang => 
    !orderedLanguages.includes(lang.code) && 
    (lang.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     lang.native_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     lang.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Settings Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <SettingsIcon size={32} className="text-slate-500" />
          Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Manage your account preferences and translation settings.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 mb-6">
        <div className="flex items-center gap-6">
          <img 
            src={user?.avatar} 
            alt="Profile" 
            className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-slate-700"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span>@{user?.username}</span>
              <span>•</span>
              <span>ORCID iD: {user?.username}</span>
            </div>
          </div>
          {user?.isAdmin && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <Shield size={14} />
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Language Preferences */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-marine-100 dark:bg-marine-900/30 rounded-lg">
            <Globe className="text-marine-600 dark:text-marine-400" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Language Preferences</h2>
            <p className="text-slate-600 dark:text-slate-400">
              The first language is your native language, and the rest are your translation preferences in order
            </p>
          </div>
        </div>

        {/* Ordered Languages List */}
        <div className="mb-6">
          {isLoadingLanguages ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marine-600"></div>
              <span className="ml-3 text-slate-600 dark:text-slate-400">Loading languages...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {orderedLanguages.map((langCode, index) => (
                <div
                  key={langCode}
                  className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === orderedLanguages.length - 1}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {getLanguageName(langCode)}
                      </span>
                      {index === 0 && (
                        <span className="text-xs px-2 py-1 bg-marine-100 dark:bg-marine-900/30 text-marine-700 dark:text-marine-300 rounded-full font-semibold">
                          Native
                        </span>
                      )}
                      {index > 0 && (
                        <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full">
                          Preference #{index}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveLanguage(langCode)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors group"
                    title="Remove language"
                  >
                    <X size={18} className="text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                  </button>
                </div>
              ))}

              {/* Add Language Button */}
              <button
                onClick={() => setShowAddLanguageModal(true)}
                disabled={isLoadingLanguages}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-marine-500 dark:hover:border-marine-400 hover:bg-marine-50 dark:hover:bg-marine-900/10 transition-all text-slate-600 dark:text-slate-400 hover:text-marine-600 dark:hover:text-marine-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
                <span className="font-medium">Add Language</span>
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-8 flex items-center justify-between">
          {hasUnsavedChanges && (
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              You have unsaved changes
            </p>
          )}
          <div className="ml-auto">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                isSaving || !hasUnsavedChanges
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-marine-600 hover:bg-marine-700 text-white shadow-sm hover:shadow active:scale-95'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Email Preferences */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-marine-100 dark:bg-marine-900/30 rounded-lg">
            <Mail className="text-marine-600 dark:text-marine-400" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Email Notification Settings</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Configure how and when you receive email notifications
            </p>
          </div>
        </div>

        {isLoadingEmailPrefs ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marine-600"></div>
            <span className="ml-3 text-slate-600 dark:text-slate-400">Loading email preferences...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Display user's email */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Notification Email</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                    {userEmail || 'No email associated with your ORCID account.'}
                  </p>
                </div>
                {!userEmail && (
                  <span className="text-xs px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full font-semibold">
                    No Email Found
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                This email is retrieved automatically from your ORCID profile during authentication.
              </p>
            </div>

            <div className="space-y-4">
              {/* Toggle for Discussion Replies */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={emailOnDiscussion}
                  onChange={(e) => {
                    setEmailOnDiscussion(e.target.checked);
                    setEmailPrefsChanged(true);
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-marine-600 focus:ring-marine-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white group-hover:text-marine-600 dark:group-hover:text-marine-400 transition-colors">
                    Discussion Replies
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Receive an email when someone replies to a discussion thread you participate in.
                  </p>
                </div>
              </label>

              {/* Toggle for Translation Status Changes */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={emailOnStatusChange}
                  onChange={(e) => {
                    setEmailOnStatusChange(e.target.checked);
                    setEmailPrefsChanged(true);
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-marine-600 focus:ring-marine-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white group-hover:text-marine-600 dark:group-hover:text-marine-400 transition-colors">
                    Translation Status Changes
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Receive an email when a translation you suggested is approved or rejected.
                  </p>
                </div>
              </label>

              {/* Digest Select */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Email Digest Frequency
                </label>
                <select
                  value={emailDigestFrequency}
                  onChange={(e) => {
                    setEmailDigestFrequency(e.target.value);
                    setEmailPrefsChanged(true);
                  }}
                  className="max-w-xs w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-marine-500 focus:border-marine-500 text-slate-900 dark:text-white text-sm"
                >
                  <option value="none">No Digest Emails</option>
                  <option value="daily">Daily Digest Summary</option>
                  <option value="weekly">Weekly Digest Summary</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive a summary of recent translation goals and activities at the selected frequency.
                </p>
              </div>
            </div>

            {/* Save Preferences Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveEmailPrefs}
                disabled={isSavingEmailPrefs || !emailPrefsChanged}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isSavingEmailPrefs || !emailPrefsChanged
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-marine-600 hover:bg-marine-700 text-white shadow-sm hover:shadow active:scale-95'
                }`}
              >
                {isSavingEmailPrefs ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Save Email Preferences
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OpenRouter API Key Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI Translation Settings</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Configure your OpenRouter API key to enable AI-powered translation suggestions
            </p>
          </div>
        </div>

        {isLoadingApiKey ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-slate-600 dark:text-slate-400">Loading API key status...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {hasApiKey ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <Key className="text-emerald-600 dark:text-emerald-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-emerald-900 dark:text-emerald-100">
                      API Key Configured
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                      You can now use AI translation features in term details and translation flow.
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteApiKey}
                    disabled={isSavingApiKey}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isSavingApiKey ? 'Deleting...' : 'Delete Key'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <Key className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      No API Key Configured
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Add your OpenRouter API key to enable AI translation features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                OpenRouter API Key
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={openRouterApiKey}
                    onChange={(e) => {
                      setOpenRouterApiKey(e.target.value);
                      setApiKeyChanged(true);
                    }}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'sk-or-v1-...'}
                    className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? (
                      <EyeOff size={18} className="text-slate-500" />
                    ) : (
                      <Eye size={18} className="text-slate-500" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleSaveApiKey}
                  disabled={isSavingApiKey || !apiKeyChanged || !openRouterApiKey.trim()}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isSavingApiKey || !apiKeyChanged || !openRouterApiKey.trim()
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-95'
                  }`}
                >
                  {isSavingApiKey ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Save Key
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Get your API key from{' '}
                <a
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  OpenRouter Settings
                </a>
                . Your key is encrypted and stored securely.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Language Modal */}
      {showAddLanguageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowAddLanguageModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Add Language</h3>
                <button
                  onClick={() => setShowAddLanguageModal(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={24} className="text-slate-500" />
                </button>
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search languages..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-marine-500 focus:border-marine-500 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            {/* Language List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {filteredLanguages.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {searchQuery ? 'No languages found matching your search.' : 'All available languages have been added.'}
                  </p>
                ) : (
                  filteredLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleAddLanguage(lang.code)}
                      className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-marine-500 hover:bg-marine-50 dark:hover:bg-marine-900/20 transition-all"
                    >
                      <div className="font-medium text-slate-900 dark:text-white">
                        {lang.name} ({lang.native_name})
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Code: {lang.code}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
