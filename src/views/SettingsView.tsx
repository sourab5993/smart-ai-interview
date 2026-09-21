import React, { useState } from 'react';
import {
  Settings,
  User,
  Volume2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Save,
  Shield,
  Sliders,
  GraduationCap,
  Languages,
  Zap,
  Palette,
  Mail,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EducationalCategory, Language } from '../types';
import { CURSOR_THEMES, CursorTheme } from '../components/Cursor3D';

export const SettingsView: React.FC = () => {
  const { user, updateProfile, changeUserCourse, coursesCatalog, jobRolesCatalog, resetToDefaultData, setCurrentView } = useApp();

  const [name, setName] = useState<string>(user.name);
  const [email, setEmail] = useState<string>(user.email);
  const [courseId, setCourseId] = useState<string>(user.courseId || 'c_btech');
  const [specialization, setSpecialization] = useState<string>(user.specialization || 'Computer Science & Engineering');
  const [targetRole, setTargetRole] = useState<string>(user.targetRole || 'Full Stack Developer');
  const [isCustomTargetRole, setIsCustomTargetRole] = useState<boolean>(false);
  const [gradYear, setGradYear] = useState<string>(user.graduationYear || '2026');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(user.preferredLanguage || 'English');
  const [cursorEnabled, setCursorEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [cursorTheme, setCursorTheme] = useState<CursorTheme>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_theme');
    return (saved as CursorTheme) || 'cyber-cyan';
  });
  const [cursorTrail, setCursorTrail] = useState<'dense' | 'light' | 'off'>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_trail');
    return (saved as 'dense' | 'light' | 'off') || 'dense';
  });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const currentCourse = coursesCatalog.find((c) => c.id === courseId) || coursesCatalog[0];
  const compatibleRoles = jobRolesCatalog.filter(
    (r) => r.associatedCourseIds?.includes(courseId) || r.recommendedCourse === currentCourse.name
  );

  const handleCourseSelect = (newCourseId: string) => {
    setCourseId(newCourseId);
    const c = coursesCatalog.find((x) => x.id === newCourseId) || coursesCatalog[0];
    const newSpec = c.specializations[0] || 'General';
    setSpecialization(newSpec);

    const roles = jobRolesCatalog.filter(
      (r) => r.associatedCourseIds?.includes(newCourseId) || r.recommendedCourse === c.name
    );
    if (roles.length > 0) {
      setTargetRole(roles[0].title);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    changeUserCourse(courseId, specialization, targetRole);

    updateProfile({
      name,
      email,
      degree: currentCourse.name,
      courseId,
      courseName: currentCourse.name,
      courseCategory: currentCourse.category,
      specialization,
      targetRole,
      graduationYear: gradYear,
      preferredLanguage,
    });

    localStorage.setItem('smart_interview_3d_cursor_enabled', String(cursorEnabled));
    localStorage.setItem('smart_interview_3d_cursor_theme', cursorTheme);
    localStorage.setItem('smart_interview_3d_cursor_trail', cursorTrail);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Reset all mock interview history, study plan progress, and settings back to initial baseline?')) {
      resetToDefaultData();
      alert('Data reset successfully to default multi-course state.');
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto" id="settings-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <Settings className="w-3.5 h-3.5" />
            <span>Multi-Discipline Profile & Platform Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Settings & Degree Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Configure your academic course, target specialization, preferred interview language, and data preferences.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Candidate Profile Details */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 pb-2 border-b border-slate-800">
            <User className="w-4 h-4" />
            <span>Candidate Profile Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Academic Degree / Faculty</label>
              <select
                value={courseId}
                onChange={(e) => handleCourseSelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
              >
                {coursesCatalog.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.name} ({c.fullName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Specialization / Major</label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
              >
                {currentCourse.specializations.map((spec) => (
                  <option key={spec} value={spec} className="bg-slate-900">
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">Target Career Role</label>
                <button
                  type="button"
                  onClick={() => setIsCustomTargetRole(!isCustomTargetRole)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  {isCustomTargetRole ? 'Choose from list' : '+ Custom Role'}
                </button>
              </div>
              {isCustomTargetRole ? (
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. AI / ML Engineer, Prompt Specialist, Cloud Architect..."
                  className="w-full bg-slate-950 border border-cyan-500/50 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none"
                />
              ) : (
                <select
                  value={targetRole}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomTargetRole(true);
                    } else {
                      setTargetRole(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  {compatibleRoles.map((r) => (
                    <option key={r.id} value={r.title} className="bg-slate-900">
                      {r.title} ({r.courseCategory})
                    </option>
                  ))}
                  <option value="__custom__" className="bg-slate-900 text-cyan-400 font-bold">
                    + Enter custom role...
                  </option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Preferred Language</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value as Language)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिंदी)</option>
                <option value="Hinglish">Hinglish (Hybrid)</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Voice & Audio Parameters */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 pb-2 border-b border-slate-800">
            <Volume2 className="w-4 h-4" />
            <span>AI Voice Speech Synthesis (TTS) & Web Speech API</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="font-bold text-slate-200">Speech Rate (Normal 1.0x)</div>
              <p className="text-slate-400 text-[11px]">Conversational cadence matching hiring bar raiser velocity.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="font-bold text-slate-200">Automatic TTS Reading</div>
              <p className="text-slate-400 text-[11px]">
                Questions are read out loud upon generation. Voice transcription operates automatically with silence detection.
              </p>
            </div>
          </div>
        </div>

        {/* 3D Cybernetic Cursor & WebGL Aesthetics */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5" id="settings-3d-cursor-section">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>3D Cybernetic Cursor Engine (WebGL / Three.js)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              Hardware Accelerated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Toggle Enable */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Enable 3D Interactive Cursor</div>
                <div className="text-[11px] text-slate-400">Gyroscopic 3D rings, particle trails & click shockwaves</div>
              </div>
              <button
                type="button"
                onClick={() => setCursorEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  cursorEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cursorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Particle Trail Intensity */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200">Particle Stream Tail</div>
                <Zap className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['dense', 'light', 'off'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCursorTrail(mode)}
                    className={`py-1 rounded-lg font-semibold uppercase tracking-wider text-[10px] border transition-all cursor-pointer ${
                      cursorTrail === mode
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Theme Palette Cards */}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cursor Radiance & Laser Color Theme</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(CURSOR_THEMES) as CursorTheme[]).map((thmKey) => {
                const thm = CURSOR_THEMES[thmKey];
                const isSelected = cursorTheme === thmKey;
                return (
                  <button
                    key={thmKey}
                    type="button"
                    onClick={() => setCursorTheme(thmKey)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-400 text-white shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: thm.primary }}
                      />
                      <span className="text-xs font-bold text-slate-200">{thm.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: thm.primary }} />
                      <span className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: thm.secondary }} />
                      <span className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: thm.accent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contact Us & Developer Support Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-950 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Need Help, Custom Modules, or Support?</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Reach out to developer support directly at <span className="text-cyan-300 font-mono font-semibold">sourabstar786@gmail.com</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('contact')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex-shrink-0"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Open Contact Us</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile updated & recalibrated!</span>
              </span>
            )}

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Recalibrate AI Coach</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
