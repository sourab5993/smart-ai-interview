import React from 'react';
import { 
  LayoutDashboard, 
  Mic, 
  BookOpen, 
  FileText, 
  TrendingUp, 
  Target, 
  CalendarDays, 
  History, 
  Bookmark, 
  Bell, 
  Settings, 
  ShieldCheck, 
  Sparkles, 
  LogOut,
  BrainCircuit,
  Award,
  ChevronRight,
  Mail
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Sidebar: React.FC = () => {
  const { user, currentView, setCurrentView, logout, notifications, isAuthenticated } = useApp();

  const unreadNotifs = notifications.filter(n => !n.read).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'practice', label: 'Practice Interview', icon: Mic, badge: 'AI Live', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { id: 'questions', label: 'Question Bank', icon: BookOpen, badge: '100+', badgeColor: 'bg-slate-800 text-slate-400 border-slate-700' },
    { id: 'resume', label: 'Resume & ATS', icon: FileText, badge: null },
    { id: 'performance', label: 'ML Performance', icon: TrendingUp, badge: 'ML', badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    { id: 'skill-gap', label: 'Skill Gap Matrix', icon: Target, badge: null },
    { id: 'study-plan', label: '7-Day Study Plan', icon: CalendarDays, badge: 'Day 4', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { id: 'history', label: 'Interview History', icon: History, badge: null },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, badge: null },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs > 0 ? String(unreadNotifs) : null, badgeColor: 'bg-cyan-500 text-slate-950 font-black' },
  ];

  const academicItem = { id: 'project-insights', label: 'Project Insights', icon: Sparkles, badge: 'FYP Demo', badgeColor: 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-cyan-300 border-cyan-500/40' };
  const adminItem = { id: 'admin', label: 'Admin Portal', icon: ShieldCheck, badge: 'Platform', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 overflow-y-auto" id="app-sidebar">
      {/* Brand Header */}
      <div>
        <div 
          onClick={() => setCurrentView('landing')} 
          className="p-5 flex items-center gap-3 border-b border-slate-800/80 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-slate-100 uppercase">
              SMART <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">INTERVIEW</span>
            </div>
            <div className="text-[8.5px] font-semibold text-slate-400 tracking-widest uppercase">
              PREPARATION & EVALUATION
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Core Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id || (item.id === 'practice' && (currentView === 'live-interview' || currentView === 'report'));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'practice' && !isAuthenticated) {
                    setCurrentView('login');
                  } else {
                    setCurrentView(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 via-blue-600/15 to-violet-600/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-950/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-transparent'
                }`}
                id={`sidebar-link-${item.id}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            System & Engineering
          </div>

          {/* Academic Project Insights */}
          <button
            type="button"
            onClick={() => setCurrentView(academicItem.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentView === academicItem.id
                ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                : 'text-cyan-400/90 hover:text-cyan-300 hover:bg-cyan-950/20 border border-cyan-500/15'
            }`}
            id="sidebar-link-project-insights"
          >
            <div className="flex items-center gap-3">
              <academicItem.icon className="w-4 h-4 text-cyan-400" />
              <span>{academicItem.label}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${academicItem.badgeColor}`}>
              {academicItem.badge}
            </span>
          </button>

          {/* Admin Dashboard - Strictly for authorized sourabstar786@gmail.com */}
          {user.isAdmin && user.email?.trim().toLowerCase() === 'sourabstar786@gmail.com' && (
            <button
              type="button"
              onClick={() => setCurrentView(adminItem.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentView === adminItem.id
                  ? 'bg-gradient-to-r from-rose-500/15 to-violet-600/15 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
              }`}
              id="sidebar-link-admin"
            >
              <div className="flex items-center gap-3">
                <adminItem.icon className="w-4 h-4 text-rose-400" />
                <span>{adminItem.label}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${adminItem.badgeColor}`}>
                {adminItem.badge}
              </span>
            </button>
          )}

          {/* Contact Us Option */}
          <button
            type="button"
            onClick={() => setCurrentView('contact')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'contact'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-transparent'
            }`}
            id="sidebar-link-contact"
          >
            <div className="flex items-center gap-3">
              <Mail className={`w-4 h-4 ${currentView === 'contact' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>Contact Us</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
              Support
            </span>
          </button>
        </nav>
      </div>

      {/* Bottom Profile & Settings Card */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <button
          type="button"
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            currentView === 'settings'
              ? 'bg-slate-800 text-slate-100 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          id="sidebar-link-settings"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings & Preferences</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* Quick User Card */}
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user.name ? user.name[0].toUpperCase() : 'S'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 truncate">{user.name}</div>
              <div className="text-[10px] text-cyan-400 font-semibold truncate">{user.targetRole}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
