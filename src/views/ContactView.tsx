import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  Check, 
  MessageSquare, 
  HelpCircle, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  HeartHandshake,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ContactView: React.FC = () => {
  const { user } = useApp();
  const contactEmail = 'sourabstar786@gmail.com';

  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    subject: 'General Inquiry / Support',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) return;

    // Create mailto fallback link to send directly via candidate email client
    const mailtoSubject = encodeURIComponent(`[Smart AI Interview Support] ${formData.subject}`);
    const mailtoBody = encodeURIComponent(
      `From: ${formData.name} (${formData.email})\nTarget Role: ${user.targetRole || 'Not specified'}\n\nMessage:\n${formData.message}`
    );
    
    // Open default email client
    window.open(`mailto:${contactEmail}?subject=${mailtoSubject}&body=${mailtoBody}`, '_blank');
    
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData(prev => ({ ...prev, message: '' }));
    }, 4000);
  };

  const supportFaqs = [
    {
      q: 'How does the AI evaluate my interview responses?',
      a: 'The system uses state-of-the-art LLM evaluation pipelines coupled with MediaPipe vision analytics to score 8 key dimensions including Technical Accuracy, Clarity, Communication, and Eye Contact.'
    },
    {
      q: 'Having issues with Camera or Microphone permissions?',
      a: 'Ensure you grant browser permissions for camera and microphone in the address bar. The mock interview works with standard WebRTC streams.'
    },
    {
      q: 'Can I request additional roles or custom question sets?',
      a: 'Yes! Reach out directly via sourabstar786@gmail.com with your role curriculum or syllabus, and our team will add support for it.'
    },
    {
      q: 'Is my interview audio/video saved privately?',
      a: 'Yes, all camera telemetry and video processing is computed locally on-device and your session reports are stored securely in your private workspace.'
    }
  ];

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto" id="contact-us-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-10 w-60 h-60 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Support & Developer Contact</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <span>Contact Us</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-cyan-400 border border-cyan-500/20 font-mono">
              24/7 Dedicated Support
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-2 leading-relaxed">
            Have questions, feedback, or need academic support for the Smart AI Interview Preparation & Evaluation platform? We are here to help!
          </p>
        </div>
      </div>

      {/* Main Grid: Direct Email Card + Message Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Contact Information & Direct Actions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Primary Email Card */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 mb-4">
              <Mail className="w-6 h-6" />
            </div>

            <h2 className="text-base font-bold text-slate-100">Official Support Email</h2>
            <p className="text-xs text-slate-400 mt-1">
              Send your queries, bug reports, or feature requests directly to our developer team.
            </p>

            {/* Email Address Display Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-mono font-semibold text-cyan-300 select-all truncate">
                {contactEmail}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Copy Email"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct Mailto Button */}
            <div className="mt-4">
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent('[Smart AI Interview Inquiry]')}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send Email Directly</span>
              </a>
            </div>
          </div>

          {/* Response Time & Details */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-200">Fast Response</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Average response time is within 12-24 hours.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-200">Academic & Project Demo Assistance</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Support for FYP evaluation, viva presentations, and project grading.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-200">Admin & Platform Verification</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Verified administrator contact: <span className="text-cyan-300 font-mono">{contactEmail}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Message Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>Send an Instant Message</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fill out the form below to quickly send your thoughts or inquiry to <span className="text-cyan-400 font-mono">{contactEmail}</span>.
                </p>
              </div>
            </div>

            {isSubmitted && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                <div>
                  <div className="font-bold">Message Drafted Successfully!</div>
                  <div>Your mail client has been opened to send directly to <b>{contactEmail}</b>. Thank you for reaching out!</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Your Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. candidate@example.com"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject / Category
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none transition-all cursor-pointer"
                >
                  <option value="General Inquiry / Support">General Inquiry / Support</option>
                  <option value="Technical Issue / Bug Report">Technical Issue / Bug Report</option>
                  <option value="Academic FYP & Viva Guidance">Academic FYP & Viva Guidance</option>
                  <option value="Feature Request or New Question Set">Feature Request or New Question Set</option>
                  <option value="Feedback on AI Evaluation">Feedback on AI Evaluation</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Your Message
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe your question, feedback, or the issue you are encountering..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Will be sent to: <strong className="text-cyan-400">{contactEmail}</strong></span>
                </span>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions Section */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 pb-2 border-b border-slate-800">
          <HelpCircle className="w-4 h-4" />
          <span>Frequently Asked Questions & Quick Help</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {supportFaqs.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-mono flex items-center justify-center font-bold">
                  Q{idx + 1}
                </span>
                <span>{faq.q}</span>
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
