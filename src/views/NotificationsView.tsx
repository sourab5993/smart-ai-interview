import React from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  Target, 
  FileText, 
  Trash2, 
  ArrowRight 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotificationsView: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, setCurrentView } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'streak':
        return <Flame className="w-4 h-4 text-amber-400" />;
      case 'gap_alert':
        return <Target className="w-4 h-4 text-rose-400" />;
      case 'study_reminder':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto" id="notifications-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
              <Bell className="w-3.5 h-3.5" />
              <span>Activity & Alerts Feed</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Notifications & Study Triggers
            </h1>
          </div>

          <button
            onClick={markAllNotificationsRead}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markNotificationRead(n.id)}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              n.read
                ? 'bg-slate-900/60 border-slate-800/80'
                : 'bg-slate-900 border-cyan-500/30 shadow-lg shadow-cyan-950/20'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0">
              {getIcon(n.type)}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs sm:text-sm font-bold ${n.read ? 'text-slate-300' : 'text-slate-100'}`}>
                  {n.title}
                </h3>
                <span className="text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
            </div>

            {n.actionUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentView(n.actionUrl as any);
                }}
                className="self-center p-2 rounded-xl bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-400 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
