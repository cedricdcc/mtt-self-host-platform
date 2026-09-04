import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';
import { backendApi } from '../services/api';
import { CONFIG } from '../config';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkBanStatus: () => Promise<void>;
  updateUserEmail: (email: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const checkBanStatus = async () => {
    try {
      // Force a non-cached check of user status
      const apiUrl = `${CONFIG.API_URL}/me`;
      const response = await fetch(apiUrl, { 
        credentials: 'include',
        cache: 'no-store', // Prevent caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if user is banned
        if (data.is_banned) {
          // Clear user state
          setUser(null);
          
          // Redirect to banned page with reason
          const params = new URLSearchParams({
            reason: data.ban_reason || 'No reason provided',
            ...(data.banned_at && { banned_at: data.banned_at })
          });
          navigate(`/banned?${params.toString()}`, { replace: true });
        }
      }
    } catch (e) {
      console.error("Failed to check ban status", e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if user is authenticated via session
        const apiUrl = `${CONFIG.API_URL}/me`;
        const response = await fetch(apiUrl, { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (!data.error) {
            // Check if user is banned
            if (data.is_banned) {
              const params = new URLSearchParams({
                reason: data.ban_reason || 'No reason provided',
                ...(data.banned_at && { banned_at: data.banned_at })
              });
              navigate(`/banned?${params.toString()}`, { replace: true });
              setIsLoading(false);
              return;
            }
            
            // Map ORCID user to our User type
            const userData: User = {
              id: data.id || data.user_id, // Use id or user_id from backend
              user_id: data.id || data.user_id, // Alias for consistency
              username: data.username || data.orcid, // Prefer username, fallback to orcid
              name: data.name || data.orcid,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || data.orcid)}&background=0ea5e9&color=fff`,
              token: data.access_token, // For compatibility with existing code
              isAdmin: Boolean(data.is_admin || data.is_superadmin), // Superadmins are always admins
              isSuperAdmin: Boolean(data.is_superadmin), // Use is_superadmin from backend session
              hasGachaAccess: Boolean(data.has_gacha_access || data.is_admin || data.is_superadmin),
              is_admin: (data.is_admin || data.is_superadmin) ? 1 : 0,
              is_superadmin: Boolean(data.is_superadmin),
              orcid: data.orcid, // Keep ORCID for reference
              reputation: data.reputation, // Include reputation if available
              email: data.email || null, // Capture email address
              languagePreferences: {
                nativeLanguage: 'en',
                translationLanguages: ['en'],
                preferredLanguages: ['en'],
                visibleExtraLanguages: []
              }
            };
            
            // Fetch user language preferences
            try {
              const preferences = await backendApi.getUserPreferences();
              if (preferences) {
                userData.languagePreferences = {
                  nativeLanguage: preferences.nativeLanguage || 'en',
                  translationLanguages: preferences.translationLanguages || ['en'],
                  preferredLanguages: preferences.preferredLanguages || ['en'],
                  visibleExtraLanguages: preferences.visibleExtraLanguages || []
                };
              }
            } catch (e) {
              console.log('Could not fetch user language preferences, using defaults', e);
            }
            
            setUser(userData);

            // Auto-process pending event team join if user was redirected from QR scan / event detail page
            const pendingJoinStr = sessionStorage.getItem("pending_event_join");
            if (pendingJoinStr) {
              try {
                const { eventId, joinCode } = JSON.parse(pendingJoinStr);
                sessionStorage.removeItem("pending_event_join");
                if (eventId && joinCode) {
                  const joinUrl = `${CONFIG.API_URL}/events/${eventId}/join`;
                  fetch(joinUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ joinCode })
                  })
                    .then(res => res.json())
                    .then(resData => {
                      if (resData.success || resData.teamName) {
                        toast.success(`Signed in successfully! Joined team ${resData.teamName || joinCode}! 🎉`, { duration: 6000 });
                      } else if (resData.error) {
                        toast.error(`Team join error: ${resData.error}`);
                      }
                      navigate(`/events/${eventId}`, { replace: true });
                    })
                    .catch(err => console.error("Auto team join error:", err));
                }
              } catch (e) {
                sessionStorage.removeItem("pending_event_join");
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to check auth status", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Check ban status on every route change (page visit)
  useEffect(() => {
    if (user && location.pathname !== '/banned') {
      checkBanStatus();
    }
  }, [location.pathname]);

  const login = () => {
    // Redirect to ORCID OAuth flow using full backend URL
    const authUrl = `${CONFIG.API_URL}/auth/orcid`;
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      const logoutUrl = `${CONFIG.API_URL}/logout`;
      await fetch(logoutUrl, { 
        method: 'POST', 
        credentials: 'include' 
      });
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateUserEmail = (email: string | null) => {
    setUser(prev => prev ? { ...prev, email } : null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading, checkBanStatus, updateUserEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};