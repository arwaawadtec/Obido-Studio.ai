import React from 'react';
import { X, BookOpen, Film, Camera, Terminal, Sliders, CheckCircle2 } from 'lucide-react';
import { storage } from '../../services/storage';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const lang = storage.getLanguagePreference();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white border border-[#E3E6EF] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E6EF] bg-[#F6F7FB]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#635BFF]" />
            <h2 className="text-base font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'دليل إنتاج الفيديو في Obido Studio' : 'Obido Studio Production Guide'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#62677A] hover:text-[#11152B] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto light-scrollbar text-xs text-[#171A2B]">
          {/* Section 1: The 8-Stage Pipeline */}
          <div className="space-y-3">
            <h3 className="font-bold text-[#11152B] text-sm flex items-center gap-1.5">
              <Film className="w-4 h-4 text-[#635BFF]" />
              <span>{lang === 'ar' ? '1. مراحل الإنتاج الثمانية' : '1. The 8-Stage Production Workflow'}</span>
            </h3>
            <p className="text-[#62677A] leading-relaxed">
              {lang === 'ar'
                ? 'ينظم استوديو أوبيدو العملية الإبداعية من الفكرة الأولية وحتى التصدير النهائي دون قفز عشوائي:'
                : 'Obido Studio enforces a rigorous, linear production hierarchy with complete human agency:'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              {[
                '1. Brief',
                '2. Script',
                '3. Storyboard',
                '4. Prompts',
                '5. Assets',
                '6. Generation',
                '7. Editing',
                '8. Export',
              ].map((stage, idx) => (
                <div key={idx} className="p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded text-center font-semibold text-[#11152B]">
                  {stage}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Pacing & Words Formula */}
          <div className="space-y-3 pt-3 border-t border-[#E3E6EF]">
            <h3 className="font-bold text-[#11152B] text-sm flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#38D9F9]" />
              <span>{lang === 'ar' ? '2. معادلة التوقيت وسرعة الإلقاء' : '2. Narration Pacing & Word Economy'}</span>
            </h3>
            <p className="text-[#62677A] leading-relaxed">
              {lang === 'ar'
                ? 'يبلغ متوسط سرعة التعليق الصوتي الاحترافي الطبيعي حوالي 130 إلى 150 كلمة في الدقيقة (حوالي 2.3 كلمة في الثانية). يقوم النظام باحتساب التوقيت الفعلي وتنبيهك في حال زيادة الكلمات عن مدة المشهد المخططة.'
                : 'Natural broadcast voiceover operates at 130 to 150 words per minute (~2.3 words/second). The script stage automatically checks word count against your planned target duration to prevent rushed voiceover.'}
            </p>
          </div>

          {/* Section 3: Cinematography Prompts */}
          <div className="space-y-3 pt-3 border-t border-[#E3E6EF]">
            <h3 className="font-bold text-[#11152B] text-sm flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#9B8CFF]" />
              <span>{lang === 'ar' ? '3. نصائح لهندسة موجهات الفيديو' : '3. Cinematography Prompting Principles'}</span>
            </h3>
            <ul className="space-y-1.5 text-[#62677A] list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-[#11152B]">Optical Realism:</strong> Specify real lens attributes (e.g. <em>35mm anamorphic, f/2.0 aperture</em>) rather than subjective words like "photorealistic".
              </li>
              <li>
                <strong className="text-[#11152B]">Explicit Camera Physics:</strong> State direction and velocity (e.g. <em>slow continuous dolly-in at 0.5m/s, static locked-off tripod</em>).
              </li>
              <li>
                <strong className="text-[#11152B]">Negative Anchors:</strong> Always exclude morphing, floating limbs, flickering, and text watermarks.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E3E6EF] bg-[#F6F7FB] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors"
          >
            {lang === 'ar' ? 'فهمت ذلك' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
