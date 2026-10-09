import React, { useState, useEffect, useRef } from 'react';
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
  LogIn,
  RotateCw,
  ExternalLink,
  Shield
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { JOB_ROLES } from '../data/mockData';
import { RoleType } from '../types';

interface AuthViewProps {
  redirectReason?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({ redirectReason }) => {
  const { currentView, setCurrentView, login, sendOtp, verifyOtpAndRegister, loginWithGoogle, updateProfile } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'otp_verify' | 'forgot'>(
    currentView === 'login' ? 'login' : currentView === 'forgot-password' ? 'forgot' : 'signup'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState<RoleType>('Full Stack Developer');
  
  // OTP Verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpInfoMessage, setOtpInfoMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);

  // Cooldown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Initialize Google Identity Services (GIS) if client id is configured
  useEffect(() => {
    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
    if (googleClientId && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              await handleGoogleCredential(response.credential);
            }
          },
        });
      } catch (err) {
        console.warn('[Google Auth] GIS Initialization notice:', err);
      }
    }
  }, []);

  const handleGoogleCredential = async (credential: string) => {
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle(credential, targetRole);
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    setAuthError(null);
    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
    const google = (window as any).google;

    if (googleClientId && google?.accounts?.id) {
      setIsGoogleLoading(true);
      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              await handleGoogleCredential(response.credential);
            } else {
              setIsGoogleLoading(false);
            }
          },
        });
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
          }
        });
      } catch (e: any) {
        setIsGoogleLoading(false);
        setAuthError(e?.message || 'Failed to open Google Sign-In prompt');
      }
    } else {
      // Show informational config guide or demo login
      setShowGoogleConfigModal(true);
    }
  };

  // Step 1: Initiate registration by validating email domain & dispatching OTP
  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setOtpInfoMessage(null);

    if (!name.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (!password || password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await sendOtp(email.trim());
      setDevOtp(result.devOtp || null);
      setOtpInfoMessage(result.message);
      setResendCooldown(60);
      setMode('otp_verify');
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err: any) {
      setAuthError(err.message || 'Unable to verify email domain. Please check your email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP input and complete registration
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const enteredOtp = otpDigits.join('').trim();
    if (enteredOtp.length !== 6) {
      setAuthError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtpAndRegister({
        name: name.trim(),
        email: email.trim(),
        otp: enteredOtp,
        password,
        targetRole,
      });
      updateProfile({
        name: name.trim(),
        targetRole,
      });
    } catch (err: any) {
      setAuthError(err.message || 'Invalid or expired verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await sendOtp(email.trim());
      setDevOtp(result.devOtp || null);
      setOtpInfoMessage(result.message);
      setResendCooldown(60);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Standard Login submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (mode === 'forgot') {
      setResetSent(true);
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Box change handler
  const handleOtpDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((char, i) => {
        if (i < 6 && /\d/.test(char)) {
          newDigits[i] = char;
        }
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    if (value && !/\d/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
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

      {/* Security Status Badge at Top Right */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-[11px] text-emerald-400 backdrop-blur-md shadow-lg">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold tracking-wide">Real-Identity Protection Active</span>
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
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
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
              {mode === 'signup' && 'Create Verified Account'}
              {mode === 'otp_verify' && 'Verify Real Email'}
              {mode === 'login' && 'Candidate Sign In'}
              {mode === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              {mode === 'signup' && 'Register with your genuine email or use 1-click Google Sign-In'}
              {mode === 'otp_verify' && 'Enter the 6-digit verification code sent to your real inbox'}
              {mode === 'login' && 'Sign in with your verified credentials or Google account'}
              {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          {mode !== 'forgot' && mode !== 'otp_verify' && (
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

          {/* Error Message Box */}
          {authError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-start gap-2 animate-in fade-in" id="auth-error-message">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{authError}</div>
            </div>
          )}

          {/* Registration Success Banner */}
          {regSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-medium">{regSuccess}</span>
            </div>
          )}

          {/* 1. GOOGLE SIGN-IN BUTTON (Displayed in login & signup modes) */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isGoogleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 hover:border-cyan-500/50 text-slate-100 font-semibold text-xs shadow-md transition-all cursor-pointer group disabled:opacity-50"
                id="btn-google-auth"
                title="Sign in with your verified Google account"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {isGoogleLoading
                    ? 'Verifying Google Account...'
                    : mode === 'signup'
                    ? 'Sign up with Google (Real ID)'
                    : 'Sign in with Google'}
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Verified
                </span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-slate-800" />
                <span className="absolute bg-slate-900 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Or continue with email
                </span>
              </div>
            </div>
          )}

          {/* 2. OTP VERIFICATION SCREEN */}
          {mode === 'otp_verify' && (
            <form className="space-y-5" onSubmit={handleVerifyOtpAndRegister}>
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200">
                <div className="font-semibold flex items-center gap-1.5 text-cyan-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Real Email Verification Required</span>
                </div>
                <p className="mt-1 text-[11px] text-cyan-200/80 leading-relaxed">
                  We sent a 6-digit verification code to <span className="font-mono font-bold text-cyan-300">{email}</span>. Only existing inboxes receive this code.
                </p>
              </div>

              {/* Development Preview Helper */}
              {devOtp && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-200">Terminal Development Code: </span>
                    <span className="font-mono font-black text-amber-300 tracking-widest text-sm bg-slate-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                      {devOtp}
                    </span>
                    <p className="mt-1 text-[10px] text-amber-400/80">
                      (Logged in terminal. To deliver to real inboxes, configure SMTP credentials in .env)
                    </p>
                  </div>
                </div>
              )}

              {/* 6 Digit Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <div className="flex justify-between gap-2 max-w-xs mx-auto">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-bold font-mono bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 outline-none transition-all"
                      id={`otp-input-${idx}`}
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                id="btn-verify-otp"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code & Creating Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    <span>Confirm Real Email & Activate</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setAuthError(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer"
                >
                  ← Edit Email Address
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* 3. SIGNUP FORM */}
          {mode === 'signup' && (
            <form className="space-y-4" onSubmit={handleInitiateRegistration}>
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Real Email Address
                  </label>
                  <span className="text-[10px] text-cyan-400 font-medium">Domain Verified</span>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none"
                    id="input-candidate-email"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  * Non-existent domains &amp; disposable temporary emails are rejected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••••••• (min. 6 characters)"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none"
                    id="input-candidate-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                id="btn-auth-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Email Domain &amp; Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Real Email &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 4. LOGIN FORM */}
          {mode === 'login' && (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
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
                    id="input-login-email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Forgot password?
                  </button>
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
                    id="input-login-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                id="btn-login-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 5. FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <>
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
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
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
                  <button
                    type="submit"
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    <span>Send Password Reset</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs text-cyan-400 hover:underline font-medium"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Switch Mode Links */}
          {mode !== 'otp_verify' && (
            <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
              {mode === 'login' ? (
                <span>
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setAuthError(null);
                    }}
                    className="text-cyan-400 font-semibold hover:underline"
                  >
                    Create verified account
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setAuthError(null);
                    }}
                    className="text-cyan-400 font-semibold hover:underline"
                  >
                    Sign In
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Security Reassurance Footer */}
        <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-[11px] text-slate-400">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Zero Fake Account Policy:</strong> Every account is validated against active mail exchange (MX) servers or Google OAuth.
          </span>
        </div>

        {/* Guest Exploration Option */}
        <div className="mt-4 text-center">
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

      {/* Google OAuth Configuration / Demo Modal */}
      {showGoogleConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Google OAuth 2.0 Integration</h3>
                  <p className="text-[11px] text-slate-400">Secure Real Google Account Verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleConfigModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google Sign-In uses official <strong>Google Identity Services (GIS)</strong> to guarantee only real, active Google accounts can sign in.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
              <div className="text-[10px] uppercase font-sans font-bold text-cyan-400">Setup Instructions:</div>
              <p className="text-[11px] font-sans text-slate-400">
                To connect your Google Client ID, add this to your <code className="text-cyan-300 font-mono">.env</code> file:
              </p>
              <div className="bg-slate-900 p-2 rounded text-[11px] text-emerald-400 overflow-x-auto">
                GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com<br />
                VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setShowGoogleConfigModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all cursor-pointer"
              >
                Close &amp; Use Email OTP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
