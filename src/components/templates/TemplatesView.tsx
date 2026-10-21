import React from 'react';
import { Layers, ArrowRight, Clock, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { TEMPLATES, storage } from '../../services/storage';

interface TemplatesViewProps {
  onSelectProject: (projectId: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onSelectProject }) => {
  const lang = storage.getLanguagePreference();

  const handleUseTemplate = (templateId: string) => {
    const proj = storage.createFromTemplate(templateId);
    if (proj) {
      onSelectProject(proj.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
          {lang === 'ar' ? 'معرض القوالب الجاهزة' : 'Production Blueprints'}
        </div>
        <h1 className="text-2xl font-bold text-[#11152B] font-display">
          {lang === 'ar' ? 'قوالب إنتاج الفيديو المعتمدة' : 'Curated Video Production Blueprints'}
        </h1>
        <p className="text-sm text-[#62677A] mt-1 max-w-2xl">
          {lang === 'ar'
            ? 'ابدأ بقوالب احترافية تضمن بنية سردية محكمة، ومعدلات إيقاع مجربة لمختلف المنصات'
            : 'Pre-engineered narrative pacing, proven camera compositions, and duration allocations for high-retention video production.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white border border-[#E3E6EF] hover:border-[#635BFF] rounded-2xl p-6 flex flex-col justify-between space-y-5 transition-all shadow-xs hover:shadow-md group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#62677A]">
                <div className="flex items-center gap-1.5 font-mono text-[#635BFF] font-bold">
                  {tpl.aspectRatio === '9:16' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                  <span>{tpl.aspectRatio}</span>
                </div>
                <div className="flex items-center gap-1 font-mono tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>{tpl.targetDurationSeconds}s · {tpl.scenesCount} scenes</span>
                </div>
              </div>

              <h2 className="text-lg font-bold text-[#11152B] group-hover:text-[#635BFF] transition-colors">
                {tpl.title}
              </h2>

              <p className="text-xs text-[#62677A] leading-relaxed">
                {tpl.description}
              </p>

              <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E3E6EF] text-xs text-[#11152B]">
                <span className="font-semibold block text-[11px] text-[#62677A] mb-1 uppercase font-mono">
                  {lang === 'ar' ? 'فكرة القالب الافتراضية' : 'Default Concept Blueprint'}
                </span>
                <span className="italic text-[#11152B]">"{tpl.defaultIdea}"</span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {tpl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-[#62677A] font-mono bg-[#F6F7FB] px-2 py-0.5 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E3E6EF] flex items-center justify-between">
              <span className="text-xs text-[#62677A]">
                {lang === 'ar' ? 'يشمل السيناريو ولوحة القصة والموجهات' : 'Includes Script & Storyboard'}
              </span>

              <button
                type="button"
                onClick={() => handleUseTemplate(tpl.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#11152B] group-hover:bg-[#635BFF] rounded-lg transition-colors whitespace-nowrap"
              >
                <span>{lang === 'ar' ? 'بدء بهذا القالب' : 'Use Blueprint'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
