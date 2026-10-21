import React, { useState } from 'react';
import { X, Sparkles, Wand2, Monitor, Smartphone, Square, Check, ArrowRight, Loader2 } from 'lucide-react';
import { AspectRatio, VideoPurpose, VisualStyle } from '../../types';
import { storage } from '../../services/storage';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const lang = storage.getLanguagePreference();

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<VideoPurpose>('explainer');
  const [targetAudience, setTargetAudience] = useState('');
  const [language, setLanguage] = useState(lang === 'ar' ? 'Arabic' : 'English');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<number>(60);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cinematic_photorealistic');
  const [rawIdea, setRawIdea] = useState('');
  const [keyTakeaway, setKeyTakeaway] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('Professional, crisp, and persuasive');
  const [callToAction, setCallToAction] = useState('Visit our website to get started');

  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAiExpand = async () => {
    if (!rawIdea.trim()) {
      setExpandError(lang === 'ar' ? 'الرجاء إدخال فكرة أولية أولاً' : 'Please provide an initial idea or concept first');
      return;
    }
    setIsExpanding(true);
    setExpandError(null);

    try {
      const res = await fetch('/api/ai/refine-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea,
          purpose,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error refining brief');
      }

      if (data.brief) {
        const b = data.brief;
        if (b.refinedTitle && !title) setTitle(b.refinedTitle);
        if (b.targetAudience) setTargetAudience(b.targetAudience);
        if (b.keyTakeaway) setKeyTakeaway(b.keyTakeaway);
        if (b.toneOfVoice) setToneOfVoice(b.toneOfVoice);
        if (b.suggestedDurationSeconds) setDuration(b.suggestedDurationSeconds);
        if (b.suggestedVisualStyle) setVisualStyle(b.suggestedVisualStyle);
        if (b.callToAction) setCallToAction(b.callToAction);
      }
    } catch (err: any) {
      console.warn('AI expand failed, using local heuristic expansion', err);
      // Clean fallback if API key is not yet set
      if (!title) setTitle(`${rawIdea.slice(0, 32)} — Production`);
      if (!targetAudience) setTargetAudience('Creators and business professionals looking for high-quality production');
      if (!keyTakeaway) setKeyTakeaway('Deliver value rapidly with measurable clarity');
      setExpandError(lang === 'ar' ? 'تم تطبيق المعالجة المبدئية محلياً' : 'Applied local brief expansion (Server AI optional)');
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitle('Untitled Video Project');
    }

    const newProject = storage.createProject({
      title: title.trim() || 'Untitled Video Project',
      purpose,
      targetAudience: targetAudience.trim() || 'General tech and media audience',
      language,
      aspectRatio,
      targetDurationSeconds: duration,
      visualStyle,
      rawIdea,
      keyTakeaway,
      toneOfVoice,
      callToAction,
    });

    onProjectCreated(newProject.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white border border-[#E3E6EF] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E6EF] bg-[#F6F7FB]">
          <div>
            <h2 className="text-lg font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'إنشاء مشروع فيديو جديد' : 'Create New Video Project'}
            </h2>
            <p className="text-xs text-[#62677A] mt-0.5">
              {lang === 'ar'
                ? 'حدد أهدافك وسيقوم Obido Studio بتوجيهك خطوة بخطوة من الفكرة إلى التصدير'
                : 'Define your production parameters to initialize the guided 8-stage production pipeline'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto light-scrollbar">
          {/* Quick AI Idea Refiner Box */}
          <div className="p-4 rounded-lg bg-[#635BFF]/5 border border-[#635BFF]/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>{lang === 'ar' ? 'الفكرة الأولية أو الملخص السريع' : 'Initial Video Idea / Prompt'}</span>
              </label>
              <button
                type="button"
                onClick={handleAiExpand}
                disabled={isExpanding || !rawIdea.trim()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#635BFF] bg-white border border-[#635BFF]/30 hover:bg-[#635BFF] hover:text-white rounded-md transition-colors disabled:opacity-50"
              >
                {isExpanding ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{lang === 'ar' ? 'جارٍ المعالجة...' : 'Analyzing...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[#38D9F9]" />
                    <span>{lang === 'ar' ? 'توسيع بالذكاء الاصطناعي' : 'AI Expand Brief'}</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              value={rawIdea}
              onChange={(e) => setRawIdea(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: فيديو ترويجي مدته 60 ثانية لتطبيق إدارة المهام الذكي مع التركيز على توفير الوقت...'
                  : 'e.g. A 60-second high-energy product launch for an autonomous AI data platform that prevents 3 AM pipeline failures...'
              }
              rows={2}
              className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-md focus:border-[#635BFF] focus:outline-none transition-colors text-[#171A2B]"
            />
            {expandError && (
              <p className="text-[11px] text-[#635BFF] mt-1.5 font-medium">{expandError}</p>
            )}
          </div>

          {/* Project Title */}
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'عنوان المشروع' : 'Project Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quantum Leap — Automated Data Workflows"
              className="w-full text-sm px-3.5 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none transition-colors"
            />
          </div>

          {/* Grid: Purpose & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الغرض من الفيديو' : 'Video Purpose'}
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as VideoPurpose)}
                className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              >
                <option value="explainer">Explainer & Technical Breakdown</option>
                <option value="marketing">Marketing & Acquisition</option>
                <option value="social_ad">High-Retention Social Ad / Hook</option>
                <option value="product_launch">Keynote & Feature Reveal</option>
                <option value="brand_story">Brand Story & Philosophy</option>
                <option value="tutorial">Educational Tutorial</option>
                <option value="documentary">Short Documentary</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'لغة الفيديو والتعليق الصوتي' : 'Language / Voiceover'}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Arabic">العربية (Arabic)</option>
                <option value="French">Français (French)</option>
                <option value="German">Deutsch (German)</option>
                <option value="Spanish">Español (Spanish)</option>
                <option value="Japanese">日本語 (Japanese)</option>
              </select>
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-2">
              {lang === 'ar' ? 'نسبة الأبعاد' : 'Aspect Ratio'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '16:9' as AspectRatio, label: '16:9 Landscape', desc: 'YouTube, Web, Desktop', icon: Monitor },
                { id: '9:16' as AspectRatio, label: '9:16 Vertical', desc: 'TikTok, Reels, Shorts', icon: Smartphone },
                { id: '1:1' as AspectRatio, label: '1:1 Square', desc: 'Instagram, LinkedIn Feed', icon: Square },
              ].map((ratio) => {
                const Icon = ratio.icon;
                const isSelected = aspectRatio === ratio.id;
                return (
                  <button
                    type="button"
                    key={ratio.id}
                    onClick={() => setAspectRatio(ratio.id)}
                    className={`flex flex-col items-center p-3 text-center rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                        : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-[#635BFF]' : 'text-[#62677A]'}`} />
                    <span className="text-xs font-semibold text-[#11152B]">{ratio.label}</span>
                    <span className="text-[10px] text-[#62677A] mt-0.5">{ratio.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration & Visual Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#11152B]">
                  {lang === 'ar' ? 'المدة المستهدفة' : 'Target Duration'}
                </label>
                <span className="text-xs font-mono font-semibold text-[#635BFF] tabular-nums">
                  {duration}s (~{Math.round((duration / 60) * 140)} words)
                </span>
              </div>
              <div className="flex gap-2">
                {[15, 30, 45, 60, 90, 120].map((dur) => (
                  <button
                    type="button"
                    key={dur}
                    onClick={() => setDuration(dur)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      duration === dur
                        ? 'bg-[#11152B] text-white border-[#11152B]'
                        : 'border-[#E3E6EF] text-[#62677A] hover:border-[#11152B]'
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'النمط البصري' : 'Visual Style'}
              </label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              >
                <option value="cinematic_photorealistic">Cinematic Photorealistic (35mm Film)</option>
                <option value="minimal_3d">Minimal 3D & Isometric</option>
                <option value="high_tech_holographic">High-Tech Holographic & Dark Studio</option>
                <option value="editorial_film">Editorial Film & Warm Natural Light</option>
                <option value="documentary_realism">Documentary Realism & Handheld</option>
                <option value="anime_vector">Stylized Anime / Vector Art</option>
              </select>
            </div>
          </div>

          {/* Target Audience & Key Takeaway */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الجمهور المستهدف' : 'Target Audience'}
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Senior software engineers, CTOs, growth marketers"
                className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الرسالة الجوهرية' : 'Core Takeaway / Message'}
              </label>
              <input
                type="text"
                value={keyTakeaway}
                onChange={(e) => setKeyTakeaway(e.target.value)}
                placeholder="e.g. Save 28 engineering hours every week"
                className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E3E6EF] flex items-center justify-between">
            <span className="text-xs text-[#62677A]">
              {lang === 'ar'
                ? 'يمكنك تعديل أي من هذه المدخلات لاحقاً في أي مرحلة'
                : 'All parameters can be modified at any stage during production'}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#62677A] hover:text-[#11152B] transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
              >
                <span>{lang === 'ar' ? 'بدء إنتاج الفيديو' : 'Initialize Production'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
