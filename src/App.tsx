import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Cursor3D } from './components/Cursor3D';

// Views
import { LandingView } from './views/LandingView';
import { AuthView } from './views/AuthView';
import { OnboardingView } from './views/OnboardingView';
import { DashboardView } from './views/DashboardView';
import { PracticeView } from './views/PracticeView';
import { ReportView } from './views/ReportView';
import { PerformanceView } from './views/PerformanceView';
import { SkillGapView } from './views/SkillGapView';
import { StudyPlanView } from './views/StudyPlanView';
import { ResumeView } from './views/ResumeView';
import { QuestionsView } from './views/QuestionsView';
import { HistoryView } from './views/HistoryView';
import { BookmarksView } from './views/BookmarksView';
import { NotificationsView } from './views/NotificationsView';
import { AdminView } from './views/AdminView';
import { ProjectInsightsView } from './views/ProjectInsightsView';
import { SettingsView } from './views/SettingsView';
import { ContactView } from './views/ContactView';

const MainAppContent: React.FC = () => {
  const { currentView, user, isAuthenticated } = useApp();

  // Full-screen un-authenticated or isolated views
  if (currentView === 'landing') {
    return <LandingView />;
  }

  if (currentView === 'auth' || currentView === 'login' || currentView === 'signup') {
    return <AuthView />;
  }

  // Interview Compulsory Login Enforcement
  if ((currentView === 'practice' || currentView === 'live-interview') && !isAuthenticated) {
    return (
      <AuthView redirectReason="Authentication Required: You must sign in or create an account to enter the AI Interview room." />
    );
  }

  if (currentView === 'onboarding') {
    return <OnboardingView />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'practice':
      case 'live-interview':
        return <PracticeView />;
      case 'report':
        return <ReportView />;
      case 'performance':
        return <PerformanceView />;
      case 'skill-gap':
        return <SkillGapView />;
      case 'study-plan':
        return <StudyPlanView />;
      case 'resume':
        return <ResumeView />;
      case 'questions':
        return <QuestionsView />;
      case 'history':
        return <HistoryView />;
      case 'bookmarks':
        return <BookmarksView />;
      case 'notifications':
        return <NotificationsView />;
      case 'admin':
        return <AdminView />;
      case 'project-insights':
        return <ProjectInsightsView />;
      case 'settings':
        return <SettingsView />;
      case 'contact':
        return <ContactView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar />

      {/* Main App Body with Sidebar */}
      <div className="flex-1 flex w-full max-w-[1700px] mx-auto overflow-hidden">
        {/* Responsive Desktop Sidebar */}
        <Sidebar />

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <Cursor3D />
      <MainAppContent />
    </AppProvider>
  );
}
