import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  Loader2,
  ShieldAlert,
  UserPlus,
  LogIn
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { JOB_ROLES } from '../data/mockData';
import { RoleType } from '../types';

interface AuthViewProps {
  redirectReason?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({ redirectReason }) => {
  const { currentView, setCurrentView, login, register, updateProfile } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(
    currentView === 'login' ? 'login' : currentView === 'forgot-password' ? 'forgot' : 'signup'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState<RoleType>('Full Stack Developer');
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (mode === 'forgot') {
      setResetSent(true);
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        await register(name, email, password, targetRole);
        updateProfile({
          name,
          targetRole,
        });
        setRegSuccess('Registration successful! Please sign in with your password to access your dashboard.');
        setMode('login');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="auth-container">
      {/* Top Back Navigation to Website */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-20">
        <button
          type="button"
          onClick={() => setCurrentView('landing')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-lg group"
          id="btn-back-to-website"
          title="Return to public website without logging in"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Website (Explore)</span>
        </button>
      </div>

      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div 
          onClick={() => setCurrentView('landing')} 
          className="inline-flex items-center gap-2.5 cursor-pointer group mb-4"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm font-black tracking-wider text-slate-100 uppercase">
              SMART <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">INTERVIEW AI</span>
            </div>
            <div className="text-[9px] font-semibold text-slate-400 tracking-widest uppercase">
              PREPARATION & EVALUATION
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {redirectReason && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-300">Login Required to Use Feature</div>
              <p className="mt-0.5 text-amber-200/90 text-[11px] leading-relaxed">
                {redirectReason} If you only want to view the website, click &quot;Back to Website&quot; to browse as a guest!
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-900/90 border border-slate-800/90 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">
              {mode === 'signup' && 'Create Candidate Account'}
              {mode === 'login' && 'Candidate Sign In'}
              {mode === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              {mode === 'signup' && 'Register first to create your candidate profile, then sign in to your dashboard'}
              {mode === 'login' && 'Sign in with your registered email and password to open your dashboard'}
              {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setAuthError(null);
                  setRegSuccess(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                id="tab-register"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>1. Register</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setAuthError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                id="tab-login"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>2. Sign In</span>
              </button>
            </div>
          )}

          {/* Registration Success Banner */}
          {regSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-medium">{regSuccess}</span>
            </div>
          )}

          {resetSent ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Password Reset Email Dispatched</h3>
              <p className="text-xs text-slate-400">
                We sent password reset instructions to <span className="text-cyan-400 font-mono">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setMode('login');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in" id="auth-error-message">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none"
                        id="input-candidate-name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Target Role
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as RoleType)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                    >
                      {JOB_ROLES.map((r, i) => (
                        <option key={i} value={r.title} className="bg-slate-900 text-slate-100">
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@example.com"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                id="btn-auth-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In to Workspace'}
                      {mode === 'signup' && 'Create Candidate Account'}
                      {mode === 'forgot' && 'Send Password Reset'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Switch Mode Links */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            {mode === 'login' ? (
              <span>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-cyan-400 font-semibold hover:underline"
                >
                  Create one now
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-cyan-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Guest Exploration Option */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setCurrentView('landing')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-cyan-300 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer shadow-sm"
            id="link-explore-as-guest"
          >
            <span>Just want to look around without signing in?</span>
            <span className="font-bold text-cyan-400 underline underline-offset-4">Explore Website as Guest →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
