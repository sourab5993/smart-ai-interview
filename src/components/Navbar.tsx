import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Search, 
  Bell, 
  User, 
  Sparkles, 
  ChevronDown, 
  LogOut, 
  Settings, 
  CheckCheck,
  ExternalLink,
  Shield,
  Sliders,
  Mail
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface NavbarProps {
  isLanding?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ isLanding = false }) => {
  const { 
    user, 
    currentView, 
    setCurrentView, 
    notifications, 
    markAllNotificationsRead,
    globalSearchQuery,
    setGlobalSearchQuery,
    logout 
  } = useApp();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLanding) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl" id="landing-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div 
            onClick={() => setCurrentView('landing')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <div className="text-sm font-black tracking-wider text-slate-100 uppercase">
                SMART <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">INTERVIEW AI</span>
              </div>
              <div className="text-[9px] font-semibold text-slate-400 tracking-widest uppercase">
                AI PREPARATION & EVALUATION
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">How It Works</a>
            <a href="#evaluation" className="hover:text-cyan-400 transition-colors">AI Evaluation</a>
            <a href="#roles" className="hover:text-cyan-400 transition-colors">Target Roles</a>
            <button 
              onClick={() => setCurrentView('project-insights')}
              className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
            >
              <span>Academic Insights</span>
              <Sparkles className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setCurrentView('contact')}
              className="text-slate-300 hover:text-cyan-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Contact Us</span>
            </button>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('login')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
              id="nav-btn-signin"
            >
              Sign In
            </button>
            <button
              onClick={() => setCurrentView('signup')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer"
              id="nav-btn-getstarted"
            >
              <span>Get Started</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 h-16 flex items-center justify-between" id="app-topbar">
      {/* Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            placeholder="Search questions, skills, past interviews, or topics..."
            className="w-full bg-slate-900/90 border border-slate-800/80 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
            id="global-search-input"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* AI Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Gemini 3.7 AI Engine Active</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
            id="btn-topbar-notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="text-xs font-bold text-slate-200">Notifications ({unreadCount} unread)</div>
                <button
                  onClick={markAllNotificationsRead}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto mt-2">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`py-2.5 px-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      n.read ? 'text-slate-400 hover:bg-slate-800/40' : 'text-slate-200 bg-cyan-500/5 hover:bg-cyan-500/10'
                    }`}
                    onClick={() => {
                      if (n.actionUrl) {
                        if (n.actionUrl.startsWith('/report/')) {
                          setCurrentView('report');
                        } else if (n.actionUrl === '/study-plan') {
                          setCurrentView('study-plan');
                        } else if (n.actionUrl === '/skill-gap') {
                          setCurrentView('skill-gap');
                        }
                      }
                      setShowNotifMenu(false);
                    }}
                  >
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      <span>{n.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 text-center">
                <button
                  onClick={() => {
                    setCurrentView('notifications');
                    setShowNotifMenu(false);
                  }}
                  className="text-[11px] font-bold text-cyan-400 hover:underline"
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            id="btn-topbar-profile"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
              {user.name ? user.name[0].toUpperCase() : 'S'}
            </div>
            <span className="hidden sm:block text-xs font-semibold text-slate-200 truncate max-w-[120px]">
              {user.name || 'Candidate'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-slate-800">
                <div className="text-xs font-bold text-slate-100 truncate">{user.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                <div className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {user.targetRole}
                </div>
              </div>
              <div className="p-1 space-y-0.5 text-xs font-medium">
                <button
                  onClick={() => {
                    setCurrentView('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile & Settings</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('project-insights');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/40 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Academic Architecture</span>
                </button>
                {user.isAdmin && user.email?.trim().toLowerCase() === 'sourabstar786@gmail.com' && (
                  <button
                    onClick={() => {
                      setCurrentView('admin');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-violet-300 hover:text-violet-200 hover:bg-violet-950/40 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-violet-400" />
                    <span>Admin Dashboard</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setCurrentView('contact');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Contact Us & Support</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
