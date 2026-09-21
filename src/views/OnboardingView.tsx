import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BrainCircuit,
  FileText,
  Mic,
  Briefcase,
  Upload,
  Check,
  Code,
  ShieldCheck,
  GraduationCap,
  Languages,
  FileUp,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EducationalCategory, DifficultyLevel, InterviewType, Language } from '../types';

export const OnboardingView: React.FC = () => {
  const { user, updateProfile, changeUserCourse, coursesCatalog, jobRolesCatalog, analyzeResumeText, parseResumeDocumentFile, setCurrentView } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('Candidate_CV.pdf');

  const [step, setStep] = useState<number>(1);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(user.courseId || 'c_btech');
  const [selectedSpec, setSelectedSpec] = useState<string>(user.specialization || 'Computer Science & Engineering');
  const [selectedRole, setSelectedRole] = useState<string>(user.targetRole || 'Full Stack Developer');
  const [experienceLevel, setExperienceLevel] = useState<string>(user.experienceLevel || 'Entry Level (0-1 yrs)');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(user.preferredLanguage || 'English');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(user.topSkills || ['TypeScript', 'React', 'Node.js', 'PostgreSQL']);
  const [interviewType, setInterviewType] = useState<InterviewType>('Technical');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [resumeText, setResumeText] = useState<string>(user.resumeText || '');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const currentCourse = coursesCatalog.find((c) => c.id === selectedCourseId) || coursesCatalog[0];
  const compatibleRoles = jobRolesCatalog.filter((r) => r.associatedCourseIds?.includes(selectedCourseId) || r.recommendedCourse === currentCourse.name);

  const handleCourseChange = (cId: string) => {
    setSelectedCourseId(cId);
    const course = coursesCatalog.find((c) => c.id === cId) || coursesCatalog[0];
    const newSpec = course.specializations[0] || 'General';
    setSelectedSpec(newSpec);

    const roles = jobRolesCatalog.filter((r) => r.associatedCourseIds?.includes(cId) || r.recommendedCourse === course.name);
    if (roles.length > 0) {
      setSelectedRole(roles[0].title);
    }
    if (course.defaultSkills && course.defaultSkills.length > 0) {
      setSelectedSkills(course.defaultSkills.slice(0, 5));
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const handleFinishOnboarding = async () => {
    setIsAnalyzing(true);
    changeUserCourse(selectedCourseId, selectedSpec, selectedRole);

    updateProfile({
      degree: currentCourse.name,
      courseId: selectedCourseId,
      courseName: currentCourse.name,
      courseCategory: currentCourse.category,
      specialization: selectedSpec,
      targetRole: selectedRole,
      experienceLevel: experienceLevel as any,
      preferredLanguage: selectedLanguage,
      topSkills: selectedSkills,
      resumeText,
    });

    if (resumeText.trim()) {
      await analyzeResumeText(resumeText, selectedRole, currentCourse.name, 'Candidate_Profile_CV.pdf');
    }

    setIsAnalyzing(false);
    setCurrentView('dashboard');
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      id="onboarding-container"
    >
      {/* Background soft glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full">
        {/* Header Progress */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Universal AI Calibration • Step {step} of 4</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {step === 1 && 'Select Your Academic Degree & Target Career'}
            {step === 2 && 'Select Your Core Domain & Technical Skills'}
            {step === 3 && 'Configure Practice Baseline & Language'}
            {step === 4 && 'Upload or Paste Your Resume (ATS Analysis)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {step === 1 && 'Whether Engineering, Commerce, Medical, Law, or Arts — the AI coach calibrates to your discipline.'}
            {step === 2 && 'Select subjects, tools, and regulatory competencies you wish to be evaluated on.'}
            {step === 3 && 'Choose your preferred language (English/Hindi/Hinglish) and interview format.'}
            {step === 4 && 'Our AI parses your projects and experience to generate personalized mock questions.'}
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-8 bg-cyan-400' : s < step ? 'w-5 bg-emerald-400' : 'w-5 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* STEP 1: Academic Degree, Specialization & Target Role */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Academic Degree / Faculty
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {coursesCatalog.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCourseChange(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedCourseId === c.id
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{c.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.fullName}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Specialization / Branch
                  </label>
                  <select
                    value={selectedSpec}
                    onChange={(e) => setSelectedSpec(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
                  >
                    {currentCourse.specializations.map((spec) => (
                      <option key={spec} value={spec} className="bg-slate-900">
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Target Career Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
                  >
                    {compatibleRoles.map((role) => (
                      <option key={role.id} value={role.title} className="bg-slate-900">
                        {role.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Experience Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Entry Level (0-1 yrs)', 'Mid-Level (2-4 yrs)', 'Senior (5+ yrs)'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperienceLevel(lvl)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                        experienceLevel === lvl
                          ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <span>Next: Select Skills</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Skills Selection */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Core Skills for {currentCourse.name} - {selectedRole}
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  Select at least 3-5 core competencies you want the AI to test during mock interviews.
                </p>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {(currentCourse.defaultSkills || currentCourse.coreSubjects || []).map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <span>Next: Interview Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Interview Settings & Language */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Preferred Communication Language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['English', 'Hindi', 'Hinglish'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLanguage(lang)}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        selectedLanguage === lang
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Languages className="w-4 h-4 text-cyan-400" />
                      <span>{lang}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Default Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="Easy">Easy (Fundamentals)</option>
                    <option value="Medium">Medium (Standard Placement)</option>
                    <option value="Hard">Hard (Senior Bar Raiser)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Primary Interview Type
                  </label>
                  <select
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Domain">Domain / Discipline</option>
                    <option value="Behavioral">Behavioral (STAR Method)</option>
                    <option value="Situational">Situational Judgment</option>
                    <option value="Case Study">Case Study</option>
                    <option value="Viva">Viva Voce</option>
                    <option value="HR">HR & Cultural Fit</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <span>Next: Resume Integration</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Resume & Finalization */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Candidate Resume / CV (Optional)
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  Upload your PDF or Word resume, or paste text to enable ATS scoring and tailored project questions.
                </p>

                {/* Document File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsExtractingDoc(true);
                    setUploadedFileName(file.name);
                    try {
                      const result = await parseResumeDocumentFile(file);
                      setResumeText(result.text);
                    } catch (err: any) {
                      console.warn('Onboarding resume parse fallback:', err);
                    } finally {
                      setIsExtractingDoc(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                  className="hidden"
                  id="onboarding-resume-input"
                />

                <div
                  onClick={() => {
                    if (!isExtractingDoc) fileInputRef.current?.click();
                  }}
                  className={`p-3 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-between mb-3 ${
                    isExtractingDoc
                      ? 'border-cyan-500 bg-cyan-950/20'
                      : 'border-slate-800 hover:border-cyan-500/50 bg-slate-950/50 hover:bg-cyan-950/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      {isExtractingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {isExtractingDoc ? 'Extracting Resume Text...' : 'Upload Resume File (PDF, DOC, DOCX)'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isExtractingDoc ? 'Parsing structure and keywords...' : 'Click to select your CV document'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isExtractingDoc}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    {isExtractingDoc ? 'Parsing...' : 'Browse'}
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder={`Candidate Profile...\nEducation: ${currentCourse.name} (${selectedSpec})\nTarget Role: ${selectedRole}\nProjects: Capstone research, domain case studies...\nSkills: ${selectedSkills.join(', ')}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>
                  Configuring {currentCourse.name} ({selectedSpec}) coach targeting &quot;{selectedRole}&quot; in {selectedLanguage}.
                </span>
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleFinishOnboarding}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAnalyzing ? 'Calibrating AI Engine...' : 'Complete Calibration & Launch Dashboard'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
