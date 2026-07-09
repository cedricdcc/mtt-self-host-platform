
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Sun, Moon, LogOut, User as UserIcon, ShieldCheck, Zap, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { parse, format, now } from '@/src/utils/datetime';
import CommunityGoalWidget from './CommunityGoalWidget';
import BottomNav from './BottomNav';
import ReportIssueModal from './ReportIssueModal';
import NotificationBell from './NotificationBell';
import EmailUrgencyModal from './EmailUrgencyModal';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isReportIssueModalOpen, setIsReportIssueModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const footerRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFooterVisible(entry.isIntersecting);
      },
      {
        threshold: 0.8,
      }
    );
    const currentFooter = footerRef.current;
    if (currentFooter) {
      observer.observe(currentFooter);
    }
    return () => {
      if (currentFooter) {
        observer.unobserve(currentFooter);
      }
    };
  }, []);

  useEffect(() => {
    // Only open if user is authenticated, has no email, and hasn't dismissed it in the current session
    if (isAuthenticated && user && !user.email) {
      const dismissed = sessionStorage.getItem('mtt_email_prompt_dismissed');
      if (dismissed !== 'true') {
        const timer = setTimeout(() => {
          setIsEmailModalOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, user]);

  const handleCloseEmailModal = () => {
    setIsEmailModalOpen(false);
    sessionStorage.setItem('mtt_email_prompt_dismissed', 'true');
  };
  
  const burgerRef = React.useRef<HTMLDivElement>(null);

  // Dark mode toggle logic
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  // Close burger menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (burgerRef.current && !burgerRef.current.contains(event.target as Node)) {
        setIsBurgerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close burger menu on navigation
  useEffect(() => {
    setIsBurgerOpen(false);
  }, [location.pathname]);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    }
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
    setIsBurgerOpen(false);
  };

  const isActive = (path: string) => location.pathname === path ? 'text-marine-600 dark:text-marine-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-marine-600 dark:hover:text-marine-300';

  // Find the topmost language that the user has chosen that is not English
  const prefs = user?.languagePreferences;
  const priorityLangs = [prefs?.nativeLanguage, ...(prefs?.translationLanguages || [])];
  const topmostNonEnglishLang = priorityLangs.find(
    (lang): lang is string => typeof lang === 'string' && lang.trim().length > 0 && lang.toLowerCase() !== 'en'
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Navbar - hidden on phone when authenticated */}
      <header className={`sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 ${isAuthenticated ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 group-hover:border-marine-500 transition-colors">
                  <img src="/mtt-logo.svg" alt="Marine Term Translations" className="w-6 h-6" />
                </div>
                <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight hidden sm:block">Marine Term Translations</span>
                <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight sm:hidden">MTT</span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8">
              {isAuthenticated ? (
                <>
                  <Link to="/browse" className={isActive('/browse')}>Browse</Link>
                  <Link to="/blog" className={isActive('/blog')}>Blog</Link>
                  {user?.isAdmin && (
                    <Link to="/admin" className={`${isActive('/admin')} flex items-center gap-1`}>
                       <ShieldCheck size={16} /> Admin
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/about" className={isActive('/about')}>About</Link>
                  <Link to="/communities" className={isActive('/communities')}>Communities</Link>
                  <Link to="/blog" className={isActive('/blog')}>Blog</Link>
                  <Link to="/documentation" className={isActive('/documentation')}>Documentation</Link>
                </>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              {/* If NOT authenticated, show the Report Issue button here */}
              {!isAuthenticated && (
                <button 
                  onClick={() => setIsReportIssueModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-marine-600 dark:hover:text-marine-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <AlertCircle size={18} />
                  <span>Report Issue</span>
                </button>
              )}

              {/* If authenticated, show Flow button and Burger Menu */}
              {isAuthenticated && (
                <>
                  {topmostNonEnglishLang && (
                    <Link
                      to={`/flow?language=${topmostNonEnglishLang}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-marine-500 to-marine-600 hover:from-marine-600 hover:to-marine-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      <Zap size={15} className="fill-white" />
                      <span>Flow</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold uppercase">
                        {topmostNonEnglishLang}
                      </span>
                    </Link>
                  )}

                  {/* Burger Menu */}
                  <div ref={burgerRef} className="relative">
                    <button 
                      onClick={() => setIsBurgerOpen(!isBurgerOpen)}
                      className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors ${isBurgerOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                      aria-label="Menu"
                    >
                      <Menu size={20} />
                    </button>
                    {isBurgerOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-50">
                        <Link 
                          to="/dashboard" 
                          className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Dashboard
                        </Link>
                        <Link 
                          to="/communities" 
                          className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Communities
                        </Link>
                        <Link 
                          to="/blog" 
                          className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Blog
                        </Link>
                        <Link 
                          to="/about" 
                          className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          About
                        </Link>
                        <Link 
                          to="/documentation" 
                          className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Documentation
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                        <button 
                          onClick={() => {
                            setIsReportIssueModalOpen(true);
                            setIsBurgerOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <AlertCircle size={16} />
                          <span>Report Issue</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              {isAuthenticated ? (
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                   <NotificationBell />
                   <div className="relative group">
                     <Link to={`/user/${user?.id || user?.user_id}`} className="flex items-center gap-2 hover:opacity-80">
                        <img src={user?.avatar} alt={user?.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden lg:block">{user?.name}</span>
                     </Link>
                     {/* Hover Dropdown */}
                     <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                        <Link to={`/user/${user?.id || user?.user_id}`} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                           <UserIcon size={16} /> My Profile
                        </Link>
                        <Link to="/settings" className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                           <SettingsIcon size={16} /> Settings
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                           <LogOut size={16} /> Sign Out
                        </button>
                     </div>
                   </div>
                </div>
              ) : (
                <Link to="/login" className="px-4 py-2 bg-marine-600 hover:bg-marine-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md">
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-4">
               <button onClick={toggleDarkMode} className="p-2 text-slate-500 dark:text-slate-400">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="p-2 text-slate-600 dark:text-slate-300"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 absolute w-full shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <button 
                onClick={() => {
                  setIsReportIssueModalOpen(true);
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600"
              >
                <AlertCircle size={18} />
                <span>Report Issue</span>
              </button>
              <Link to="/about" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>About</Link>
              <Link to="/blog" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Blog</Link>
              <Link to="/leaderboard" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Community</Link>
              <Link to="/documentation" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Documentation</Link>
               {isAuthenticated && (
                <>
                  <Link to="/browse" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Browse Terms</Link>
                  <Link to="/dashboard" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
                  <Link to={`/user/${user?.id || user?.user_id}`} className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>My Profile</Link>
                  <Link to="/settings" className="block py-2 text-slate-600 dark:text-slate-300 hover:text-marine-600" onClick={() => setIsMenuOpen(false)}>Settings</Link>
                   {user?.isAdmin && (
                    <Link to="/admin" className="block py-2 text-marine-600 dark:text-marine-400 font-semibold" onClick={() => setIsMenuOpen(false)}>Admin Dashboard</Link>
                  )}
                  <button onClick={handleLogout} className="w-full text-left py-2 text-red-500 font-medium">Sign Out</button>
                </>
              )}
              {!isAuthenticated && (
                 <Link to="/login" className="block w-full text-center py-3 mt-4 bg-marine-600 text-white rounded-lg font-medium" onClick={() => setIsMenuOpen(false)}>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={`flex-grow ${isAuthenticated ? 'mb-16 md:mb-0' : ''}`}>
        {children}
      </main>

      {/* Footer - hidden on phone when authenticated */}
      <footer 
        ref={footerRef}
        className={`bg-slate-100 dark:bg-slate-955 border-t border-slate-200 dark:border-slate-800 ${isAuthenticated ? 'hidden md:block' : ''}`}
      >
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-500 ease-in-out ${isFooterVisible ? 'py-14' : 'py-8'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src="/mtt-logo.svg" 
                alt="Marine Term Translations" 
                className={`transition-all duration-500 ease-in-out transform group-hover:scale-105 active:scale-95 ${isFooterVisible ? 'w-7 h-7' : 'w-5 h-5'}`} 
              />
              <span className={`font-semibold text-slate-700 dark:text-slate-300 transition-all duration-500 ease-in-out ${isFooterVisible ? 'text-lg' : 'text-base'}`}>
                Marine Term Translations
              </span>
            </Link>
            <div className={`flex items-center border-slate-300 dark:border-slate-800 sm:border-l sm:pl-6 py-1 transition-all duration-500 ease-in-out ${isFooterVisible ? 'gap-3' : 'gap-2'}`}>
              <span className={`text-slate-500 dark:text-slate-400 font-medium transition-all duration-500 ease-in-out ${isFooterVisible ? 'text-sm' : 'text-xs'}`}>
                Sponsored by
              </span>
              <a 
                href="https://emodnet.ec.europa.eu/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:scale-105 active:scale-95 transition-transform duration-200"
              >
                <img 
                  src="/emodnet-logo.png" 
                  alt="EMODnet" 
                  className={`object-contain bg-white/90 dark:bg-white px-1.5 py-0.5 rounded transition-all duration-500 ease-in-out ${isFooterVisible ? 'h-14' : 'h-6'}`} 
                />
              </a>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">
            &copy; {format(parse(now()), 'YYYY')} Marine Term Translations. Data sourced from NERC Vocabulary Server.
          </p>
        </div>
      </footer>

      {/* Community Goals Widget - hidden on mobile */}
      {isAuthenticated && <CommunityGoalWidget className="hidden md:block" />}
      
      {/* Bottom Navigation - only on phone when authenticated */}
      {isAuthenticated && <BottomNav />}

      {/* Report Issue Modal */}
      <ReportIssueModal 
        isOpen={isReportIssueModalOpen} 
        onClose={() => setIsReportIssueModalOpen(false)} 
      />

      {/* Email Urgency Modal */}
      <EmailUrgencyModal
        isOpen={isEmailModalOpen}
        onClose={handleCloseEmailModal}
      />
    </div>
  );
};

export default Layout;
