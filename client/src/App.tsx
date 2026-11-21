import { lazy, Suspense, useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useSupabaseAuth } from "./contexts/SupabaseAuthContext";
import AppShell from "./components/app/AppShell";
import NotFound from "./pages/NotFound";

const Home = lazy(() =>
  import("./pages/Home").then(m => ({ default: m.Home }))
);
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() =>
  import("./pages/InterviewPages").then(m => ({ default: m.Dashboard }))
);
const PracticeSetup = lazy(() =>
  import("./pages/InterviewPages").then(m => ({ default: m.PracticeSetup }))
);
const InterviewRoom = lazy(() =>
  import("./pages/InterviewPages").then(m => ({ default: m.InterviewRoom }))
);
const ReportPage = lazy(() =>
  import("./pages/InterviewPages").then(m => ({ default: m.ReportPage }))
);
const QuestionsPage = lazy(() =>
  import("./pages/PreparePages").then(m => ({ default: m.QuestionsPage }))
);
const ResumePage = lazy(() =>
  import("./pages/PreparePages").then(m => ({ default: m.ResumePage }))
);
const StudyPlanPage = lazy(() =>
  import("./pages/PreparePages").then(m => ({ default: m.StudyPlanPage }))
);
const PerformancePage = lazy(() =>
  import("./pages/AnalyticsPages").then(m => ({ default: m.PerformancePage }))
);
const SkillGapPage = lazy(() =>
  import("./pages/AnalyticsPages").then(m => ({ default: m.SkillGapPage }))
);
const HistoryPage = lazy(() =>
  import("./pages/AnalyticsPages").then(m => ({ default: m.HistoryPage }))
);
const BookmarksPage = lazy(() =>
  import("./pages/AnalyticsPages").then(m => ({ default: m.BookmarksPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/AccountPages").then(m => ({ default: m.SettingsPage }))
);
const AdminPage = lazy(() =>
  import("./pages/AccountPages").then(m => ({ default: m.AdminPage }))
);
const ProjectInsightsPage = lazy(() => import("./pages/ProjectInsightsPage"));
const ProjectStatusPage = lazy(() => import("./pages/ProjectStatusPage"));
const BehavioralSetup = lazy(() =>
  import("./features/behavioral-interview/BehavioralInterviewPages").then(
    m => ({ default: m.BehavioralSetup })
  )
);
const BehavioralRoom = lazy(() =>
  import("./features/behavioral-interview/BehavioralInterviewPages").then(
    m => ({ default: m.BehavioralRoom })
  )
);
const BehavioralReport = lazy(() =>
  import("./features/behavioral-interview/BehavioralInterviewPages").then(
    m => ({ default: m.BehavioralReport })
  )
);
const LiveInterviewSetup = lazy(() =>
  import("./features/live-interview/LiveInterviewPages").then(m => ({
    default: m.LiveInterviewSetup,
  }))
);
const LiveInterviewRoom = lazy(() =>
  import("./features/live-interview/LiveInterviewPages").then(m => ({
    default: m.LiveInterviewRoom,
  }))
);
const LiveInterviewReport = lazy(() =>
  import("./features/live-interview/LiveInterviewPages").then(m => ({
    default: m.LiveInterviewReport,
  }))
);

function Private({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSupabaseAuth();
  if (!ready)
    return (
      <div className="center-screen">
        <span className="spinner" />
        <p>Opening your private workspace…</p>
      </div>
    );
  if (!user) return <Redirect to="/login" />;
  return <AppShell>{children}</AppShell>;
}
function AdminPrivate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSupabaseAuth();
  if (!ready)
    return (
      <div className="center-screen">
        <span className="spinner" />
        <p>Checking administrator access…</p>
      </div>
    );
  if (!user) return <Redirect to="/login" />;
  return <div className="admin-standalone">{children}</div>;
}
function LoadingPage() {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" />
      <span>Preparing your interview workspace…</span>
    </div>
  );
}

function AuthCallbackRedirect() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(
      [window.location.search.replace(/^\?/, ""), hash]
        .filter(Boolean)
        .join("&")
    );
    const errorCode = params.get("error_code");
    const error = params.get("error");
    if (!errorCode && !error) return;

    const code = errorCode || error || "auth_error";
    window.history.replaceState(null, "", window.location.pathname);
    navigate(`/login?auth_error=${encodeURIComponent(code)}`, {
      replace: true,
    });
  }, [navigate]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AuthCallbackRedirect />
          <Suspense fallback={<LoadingPage />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/login">
                <AuthPage mode="login" />
              </Route>
              <Route path="/signup">
                <AuthPage mode="signup" />
              </Route>
              <Route path="/forgot-password">
                <AuthPage mode="forgot" />
              </Route>
              <Route path="/reset-password">
                <AuthPage mode="reset" />
              </Route>
              <Route path="/project-status" component={ProjectStatusPage} />
              <Route path="/onboarding">
                <Private>
                  <Onboarding />
                </Private>
              </Route>
              <Route path="/app">
                <Private>
                  <Dashboard />
                </Private>
              </Route>
              <Route path="/practice">
                <Private>
                  <PracticeSetup />
                </Private>
              </Route>
              <Route path="/practice/:id">
                <Private>
                  <InterviewRoom />
                </Private>
              </Route>
              <Route path="/behavioral-interview">
                <Private>
                  <BehavioralSetup />
                </Private>
              </Route>
              <Route path="/behavioral-interview/:id">
                <Private>
                  <BehavioralRoom />
                </Private>
              </Route>
              <Route path="/behavioral-report/:id">
                <Private>
                  <BehavioralReport />
                </Private>
              </Route>
              <Route path="/live-interview">
                <Private>
                  <LiveInterviewSetup />
                </Private>
              </Route>
              <Route path="/live-interview/:id">
                <Private>
                  <LiveInterviewRoom />
                </Private>
              </Route>
              <Route path="/live-report/:id">
                <Private>
                  <LiveInterviewReport />
                </Private>
              </Route>
              <Route path="/report/:id">
                <Private>
                  <ReportPage />
                </Private>
              </Route>
              <Route path="/questions">
                <Private>
                  <QuestionsPage />
                </Private>
              </Route>
              <Route path="/resume">
                <Private>
                  <ResumePage />
                </Private>
              </Route>
              <Route path="/performance">
                <Private>
                  <PerformancePage />
                </Private>
              </Route>
              <Route path="/skill-gap">
                <Private>
                  <SkillGapPage />
                </Private>
              </Route>
              <Route path="/study-plan">
                <Private>
                  <StudyPlanPage />
                </Private>
              </Route>
              <Route path="/history">
                <Private>
                  <HistoryPage />
                </Private>
              </Route>
              <Route path="/history/:id">
                <Private>
                  <ReportPage />
                </Private>
              </Route>
              <Route path="/bookmarks">
                <Private>
                  <BookmarksPage />
                </Private>
              </Route>
              <Route path="/settings">
                <Private>
                  <SettingsPage />
                </Private>
              </Route>
              <Route path="/project-insights">
                <Private>
                  <ProjectInsightsPage />
                </Private>
              </Route>
              <Route path="/admin">
                <AdminPrivate>
                  <AdminPage />
                </AdminPrivate>
              </Route>
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;
