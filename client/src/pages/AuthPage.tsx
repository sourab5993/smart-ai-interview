import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { authRedirectUrl } from "@/lib/auth-redirect";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

type Mode = "login" | "signup" | "forgot" | "reset";
export default function AuthPage({ mode }: { mode: Mode }) {
  const [location, navigate] = useLocation();
  const { configured, user } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const signup = mode === "signup",
    forgot = mode === "forgot",
    reset = mode === "reset";
  useEffect(() => {
    if (!configured) {
      setSchemaReady(null);
      return;
    }
    let active = true;
    void getSupabase()
      .then(async client => {
        const { count, error: schemaError } = await client
          .from("course_categories")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        if (!active) return;
        const code = String(schemaError?.code || "");
        if (!schemaError) setSchemaReady((count ?? 0) > 0);
        else if (code === "PGRST205" || code === "42P01" || code === "42501") {
          setSchemaReady(false);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [configured]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError === "otp_expired") {
      setError(
        "That verification link has expired or was already used. Enter your email below and request a fresh verification email."
      );
    } else if (authError) {
      setError(
        "That authentication link is no longer valid. Please request a new one and try again."
      );
    }
  }, []);
  const title = signup
    ? "Create your coach profile"
    : forgot
      ? "Reset your password"
      : reset
        ? "Choose a new password"
        : "Welcome back";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = await getSupabase();
      if (signup) {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: authRedirectUrl(
              "/onboarding",
              window.location.origin
            ),
          },
        });
        if (err) throw err;
        if (data.session) navigate("/onboarding");
        else
          setNotice(
            "Check your inbox for a verification link. Once verified, you can build your interview profile."
          );
      } else if (forgot) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: authRedirectUrl(
              "/reset-password",
              window.location.origin
            ),
          }
        );
        if (err) throw err;
        setNotice(
          "If an account exists for that address, a password reset link is on its way."
        );
      } else if (reset) {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setNotice("Password updated. You can continue to your workspace.");
        window.setTimeout(() => navigate("/app"), 1000);
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        navigate("/app");
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function startGoogleOAuth() {
    setBusy(true);
    setError("");
    try {
      const supabase = await getSupabase();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl("/onboarding", window.location.origin),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function resendVerification() {
    if (!email.trim()) {
      setError(
        "Enter your email address first, then request a fresh verification email."
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = await getSupabase();
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectUrl(
            "/onboarding",
            window.location.origin
          ),
        },
      });
      if (err) throw err;
      setNotice(
        "A fresh verification link is on its way. Open the newest email only."
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  if (user && mode === "login")
    return (
      <main className="auth-page">
        <section className="auth-card">
          <BrandMini />
          <p className="eyebrow">SESSION ACTIVE</p>
          <h1>You're already signed in.</h1>
          <p className="muted">Pick up where your preparation left off.</p>
          <Link href="/app" className="button button-primary">
            Open your dashboard <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />
      <section className="auth-card">
        <BrandMini />
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>
        <div className="auth-kicker">
          <span className="tiny-orb" /> YOUR NEXT ANSWER STARTS HERE
        </div>
        <h1>{title}</h1>
        <p className="muted">
          {signup
            ? "A practice space that adapts to your course, strengths and career direction."
            : forgot
              ? "We'll send a secure password reset link to your email."
              : reset
                ? "Use a strong password you haven't used elsewhere."
                : "Your progress is waiting—pick up right where you left off."}
        </p>
        {!configured && (
          <div className="notice notice-warning">
            Supabase is not configured in this environment. Ask the project
            owner to finish the secure project setup.
          </div>
        )}
        {schemaReady === false && (
          <div className="notice notice-warning" role="status">
            The Supabase app database is not initialized yet. The project owner
            must apply every numbered SQL migration in order before signup,
            interviews and saved progress can work.
          </div>
        )}
        {notice && (
          <div className="notice notice-success" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="auth-form">
          {signup && (
            <label>
              Full name
              <div className="input-wrap">
                <Fingerprint size={17} />
                <input
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={100}
                />
              </div>
            </label>
          )}
          {!reset && (
            <label>
              Email address
              <div className="input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  maxLength={320}
                />
              </div>
            </label>
          )}
          {!forgot && (
            <label>
              {reset ? "New password" : "Password"}
              <div className="input-wrap">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    signup
                      ? "new-password"
                      : reset
                        ? "new-password"
                        : "current-password"
                  }
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={
                    reset ? "At least 8 characters" : "At least 8 characters"
                  }
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}
          {!signup && !forgot && !reset && (
            <div className="form-between">
              <span className="muted-small">Secured with Supabase Auth</span>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          )}
          <button
            className="button button-primary auth-submit"
            disabled={busy || !configured}
          >
            {busy ? <span className="spinner" /> : null}
            {busy
              ? "Working…"
              : signup
                ? "Create account"
                : forgot
                  ? "Send reset link"
                  : reset
                    ? "Update password"
                    : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!forgot && !reset && (
          <button
            className="button button-secondary auth-submit google-auth-button"
            type="button"
            disabled={busy || !configured}
            onClick={() => void startGoogleOAuth()}
          >
            <span aria-hidden="true" className="google-g-mark">
              G
            </span>
            Continue with Google
          </button>
        )}
        {!signup && !forgot && !reset && (
          <button
            className="button button-ghost auth-submit"
            type="button"
            disabled={busy || !configured}
            onClick={() => void resendVerification()}
          >
            Resend verification email
          </button>
        )}
        {!forgot && !reset && (
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to the platform?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        )}
        {reset && notice && (
          <p className="auth-switch">
            <Link href="/login">Continue to sign in</Link>
          </p>
        )}
        <div className="auth-foot">
          <Sparkles size={14} /> Practice is private. Your answers belong to
          you.
        </div>
      </section>
    </main>
  );
}
function BrandMini() {
  return (
    <Link href="/" className="brand brand-auth">
      <span className="brand-mark">
        <span />
      </span>
      <span>
        SMART <b>INTERVIEW</b>
      </span>
    </Link>
  );
}
function friendlyError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";
  if (/invalid login credentials/i.test(msg))
    return "That email and password combination didn't match. Check them and try again.";
  if (/already registered/i.test(msg))
    return "An account already exists for this email. Try signing in instead.";
  if (/password/i.test(msg))
    return "Your password must contain at least 8 characters.";
  if (/fetch|network/i.test(msg))
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  return "We couldn't complete that account request. Please check your details and try again.";
}
