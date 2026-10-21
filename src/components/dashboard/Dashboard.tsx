import React, { useState } from 'react';
import {
  Video,
  Plus,
  ArrowRight,
  Clock,
  Film,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Download,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Project } from '../../types';
import { storage, TEMPLATES } from '../../services/storage';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onSelectProject,
  onOpenCreateModal,
}) => {
  const lang = storage.getLanguagePreference();
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeProjectId = storage.getActiveProjectId();
  const mostRecentProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brief.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = filterStage === 'all' || p.currentStage === filterStage;
    return matchesSearch && matchesStage;
  });

  const handleTemplateClick = (templateId: string) => {
    const newProj = storage.createFromTemplate(templateId);
    if (newProj) {
      onSelectProject(newProj.id);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const imported = storage.importProjectJSON(content);
          if (imported) {
            onSelectProject(imported.id);
          } else {
            alert(lang === 'ar' ? 'فشل استيراد المشروع. تنسيق غير صالح.' : 'Failed to import project. Invalid format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const formatStageLabel = (stage: string) => {
    switch (stage) {
      case 'brief': return lang === 'ar' ? 'الملخص' : 'Brief';
      case 'script': return lang === 'ar' ? 'السيناريو' : 'Script';
      case 'storyboard': return lang === 'ar' ? 'لوحة القصة' : 'Storyboard';
      case 'prompts': return lang === 'ar' ? 'الموجهات' : 'Prompts';
      case 'assets': return lang === 'ar' ? 'الوسائط' : 'Assets';
      case 'generation': return lang === 'ar' ? 'التوليد' : 'Generation';
      case 'editing': return lang === 'ar' ? 'المونتاج' : 'Editing';
      case 'export': return lang === 'ar' ? 'التصدير' : 'Export';
      default: return stage;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      {/* Hero Welcome & Primary Callout */}
      <div className="relative rounded-2xl bg-[#11152B] text-white p-8 overflow-hidden shadow-sm">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#635BFF]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#38D9F9]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-[#38D9F9] font-mono tracking-wider uppercase">
              <span>{lang === 'ar' ? 'مساحة العمل المتكاملة' : 'Production Workspace'}</span>
              <span aria-hidden="true">·</span>
              <span>v1.0 Foundation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              {lang === 'ar'
                ? 'مرحباً بك في استوديو أوبيدو لإنتاج الفيديو'
                : 'Build studio-grade video from concept to timeline'}
            </h1>
            <p className="text-sm text-[#E3E6EF]/80 leading-relaxed">
              {lang === 'ar'
                ? 'سير عمل إنتاج كامل يربط الملخص، وتوليد السيناريو، وتخطيط لوحة القصة، وصياغة موجهات الكاميرا، والتحرير متعدد المسارات مع التحكم البشري الكامل.'
                : 'A structured, human-controlled video creation workspace guiding you through brief development, AI script drafting, scene storyboarding, camera prompt engineering, and multi-track editing.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleImportClick}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'استيراد مشروع' : 'Import Project'}</span>
            </button>

            <button
              onClick={onOpenCreateModal}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-[#11152B] bg-[#38D9F9] hover:bg-[#635BFF] hover:text-white rounded-lg shadow-md transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{lang === 'ar' ? 'مشروع فيديو جديد' : 'Create Video'}</span>
            </button>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="relative z-10 mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[#E3E6EF]/60 block text-[11px]">
              {lang === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}
            </span>
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {projects.length}
            </span>
          </div>
          <div>
            <span className="text-[#E3E6EF]/60 block text-[11px]">
              {lang === 'ar' ? 'المشاهد المخططة' : 'Total Scenes'}
            </span>
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {projects.reduce((acc, p) => acc + (p.scenes?.length || 0), 0)}
            </span>
          </div>
          <div>
            <span className="text-[#E3E6EF]/60 block text-[11px]">
              {lang === 'ar' ? 'حالة التخزين' : 'Persistence Mode'}
            </span>
            <span className="text-sm font-semibold text-[#38D9F9] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'محلي / نموذج أولي' : 'Local Prototype'}</span>
            </span>
          </div>
          <div>
            <span className="text-[#E3E6EF]/60 block text-[11px]">
              {lang === 'ar' ? 'محرك الذكاء الاصطناعي' : 'Gemini Adapter'}
            </span>
            <span className="text-sm font-semibold text-white flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3 text-[#9B8CFF]" />
              <span>gemini-3.8-flash</span>
            </span>
          </div>
        </div>
      </div>

      {/* Active Project Highlight Banner */}
      {mostRecentProject && (
        <div className="p-5 bg-white border border-[#E3E6EF] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#62677A]">
              <span className="font-semibold text-[#635BFF]">{lang === 'ar' ? 'المشروع النشط الحالي' : 'Active Project'}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{formatStageLabel(mostRecentProject.currentStage)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{mostRecentProject.brief.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{mostRecentProject.brief.targetDurationSeconds}s</span>
            </div>
            <h3 className="text-base font-bold text-[#11152B]">
              {mostRecentProject.title}
            </h3>
            <p className="text-xs text-[#62677A] line-clamp-1">
              {mostRecentProject.brief.rawIdea || mostRecentProject.description}
            </p>
          </div>

          <button
            onClick={() => onSelectProject(mostRecentProject.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors whitespace-nowrap self-start md:self-auto"
          >
            <span>{lang === 'ar' ? 'متابعة الإنتاج' : 'Resume Production'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Production Starter Templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'قوالب الإنتاج السريعة' : 'Quick Production Starters'}
            </h2>
            <p className="text-xs text-[#62677A]">
              {lang === 'ar'
                ? 'ابدأ بهيكل سيناريو ومشاهد معد مسبقاً لمختلف صيغ الفيديو'
                : 'Initialize with pre-structured pacing, scene blueprints, and proven narrative formulas'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => handleTemplateClick(tpl.id)}
              className="p-4 bg-white border border-[#E3E6EF] hover:border-[#635BFF] rounded-xl transition-all cursor-pointer group flex flex-col justify-between shadow-xs hover:shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#62677A]">
                  <span className="font-mono font-semibold text-[#635BFF] tabular-nums">
                    {tpl.aspectRatio}
                  </span>
                  <span className="font-mono tabular-nums">
                    {tpl.targetDurationSeconds}s · {tpl.scenesCount} scenes
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#11152B] group-hover:text-[#635BFF] transition-colors leading-snug">
                  {tpl.title}
                </h3>
                <p className="text-xs text-[#62677A] line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E3E6EF] flex items-center justify-between text-xs text-[#635BFF] font-medium">
                <span>{lang === 'ar' ? 'استخدم القالب' : 'Use Template'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'مشاريعي' : 'My Projects'}
            </h2>
            <p className="text-xs text-[#62677A]">
              {lang === 'ar' ? 'إدارة وتعديل مسودات الإنتاج' : 'Manage, review, and resume your video pipelines'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث بالاسم...' : 'Search projects...'}
              className="text-xs px-3 py-1.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none w-48"
            />

            {/* Filter by Stage */}
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none text-[#62677A]"
            >
              <option value="all">{lang === 'ar' ? 'جميع المراحل' : 'All Stages'}</option>
              <option value="brief">Brief</option>
              <option value="script">Script</option>
              <option value="storyboard">Storyboard</option>
              <option value="prompts">Prompts</option>
              <option value="generation">Generation</option>
              <option value="editing">Editing</option>
              <option value="export">Export</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
            <Film className="w-10 h-10 text-[#62677A]/40 mx-auto" />
            <h3 className="text-sm font-semibold text-[#11152B]">
              {lang === 'ar' ? 'لا توجد مشاريع تطابق البحث' : 'No projects found'}
            </h3>
            <p className="text-xs text-[#62677A] max-w-sm mx-auto">
              {lang === 'ar'
                ? 'ابدأ بإنشاء أول مشروع فيديو لك لتحويل أفكارك إلى مشاهد حقيقية'
                : 'Create a new project or select one of the starter blueprints above to begin.'}
            </p>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] rounded-lg hover:bg-[#5249ea] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إنشاء فيديو جديد' : 'Create New Video'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const scenesCount = project.scenes?.length || 0;
              const hasScript = project.scripts?.length > 0;
              const hasClips = project.timeline?.clips?.length > 0;

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="p-5 bg-white border border-[#E3E6EF] hover:border-[#635BFF] rounded-xl transition-all cursor-pointer group flex flex-col justify-between shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    {/* Top metadata line without pills */}
                    <div className="flex items-center justify-between text-xs text-[#62677A]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#11152B] capitalize">
                          {formatStageLabel(project.currentStage)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{project.brief.aspectRatio}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{project.brief.targetDurationSeconds}s</span>
                      </div>

                      <span className="text-[11px] text-[#62677A] font-mono">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#11152B] group-hover:text-[#635BFF] transition-colors line-clamp-1">
                      {project.title}
                    </h3>

                    <p className="text-xs text-[#62677A] line-clamp-2 leading-relaxed">
                      {project.brief.rawIdea || project.description || 'No concept description provided.'}
                    </p>

                    {/* Progress checkpoints */}
                    <div className="pt-2 border-t border-[#E3E6EF] flex items-center gap-3 text-[11px] text-[#62677A]">
                      <span className={hasScript ? 'text-[#16A34A] font-medium' : 'text-[#62677A]'}>
                        {hasScript ? '✓ Script' : '○ Script'}
                      </span>
                      <span>·</span>
                      <span className={scenesCount > 0 ? 'text-[#16A34A] font-medium' : 'text-[#62677A]'}>
                        {scenesCount > 0 ? `✓ ${scenesCount} Scenes` : '○ Storyboard'}
                      </span>
                      <span>·</span>
                      <span className={hasClips ? 'text-[#16A34A] font-medium' : 'text-[#62677A]'}>
                        {hasClips ? '✓ Timeline' : '○ Editor'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E3E6EF] flex items-center justify-between text-xs">
                    <span className="text-xs text-[#62677A]">
                      {project.brief.language} · {project.brief.purpose}
                    </span>
                    <span className="text-[#635BFF] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>{lang === 'ar' ? 'فتح' : 'Open'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
