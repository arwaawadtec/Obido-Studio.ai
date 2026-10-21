import React from 'react';
import {
  FileText,
  AlignLeft,
  LayoutGrid,
  Terminal,
  FolderOpen,
  Cpu,
  Sliders,
  Share2,
  Check,
  ChevronRight,
  Download,
  Trash2,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { Project, WorkflowStage } from '../../types';
import { storage } from '../../services/storage';

interface WorkspaceHeaderProps {
  project: Project;
  currentStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
  onBackToDashboard: () => void;
}

const STAGES: { id: WorkflowStage; labelEn: string; labelAr: string; icon: any }[] = [
  { id: 'brief', labelEn: 'Brief', labelAr: 'الملخص', icon: FileText },
  { id: 'script', labelEn: 'Script', labelAr: 'السيناريو', icon: AlignLeft },
  { id: 'storyboard', labelEn: 'Storyboard', labelAr: 'لوحة القصة', icon: LayoutGrid },
  { id: 'prompts', labelEn: 'Prompts', labelAr: 'الموجهات', icon: Terminal },
  { id: 'assets', labelEn: 'Assets', labelAr: 'الوسائط', icon: FolderOpen },
  { id: 'generation', labelEn: 'Generation', labelAr: 'التوليد', icon: Cpu },
  { id: 'editing', labelEn: 'Editing', labelAr: 'المونتاج', icon: Sliders },
  { id: 'export', labelEn: 'Export', labelAr: 'التصدير', icon: Share2 },
];

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  project,
  currentStage,
  onSelectStage,
  onBackToDashboard,
}) => {
  const lang = storage.getLanguagePreference();

  const handleExportJSON = () => {
    const json = storage.exportProjectJSON(project.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_obido_project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المشروع؟' : 'Are you sure you want to delete this project?')) {
      storage.deleteProject(project.id);
      onBackToDashboard();
    }
  };

  return (
    <div className="w-full bg-white border-b border-[#E3E6EF]">
      {/* Top Breadcrumb & Metadata Row */}
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E3E6EF]/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs text-[#62677A] hover:text-[#11152B] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'الرئيسية' : 'Dashboard'}</span>
          </button>

          <span className="text-[#E3E6EF]">/</span>

          <h1 className="text-sm font-bold text-[#11152B] truncate max-w-[280px] sm:max-w-md">
            {project.title}
          </h1>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#62677A]">
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.brief.aspectRatio}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.brief.targetDurationSeconds}s</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{project.brief.visualStyle.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Right Project Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-[#16A34A] font-medium mr-2">
            <Check className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'محفوظ محلياً' : 'Saved Locally'}</span>
          </div>

          <button
            onClick={handleExportJSON}
            title={lang === 'ar' ? 'تصدير بيانات المشروع JSON' : 'Export Project JSON'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded-md border border-[#E3E6EF] transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            onClick={handleDelete}
            title={lang === 'ar' ? 'حذف المشروع' : 'Delete Project'}
            className="p-1.5 text-[#62677A] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 8-Stage Production Stepper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-none py-2">
        <nav className="flex items-center min-w-max gap-1">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = currentStage === stage.id;
            const isCompleted = project.completedStages.includes(stage.id);

            return (
              <React.Fragment key={stage.id}>
                <button
                  onClick={() => onSelectStage(stage.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#11152B] text-white shadow-xs'
                      : isCompleted
                      ? 'text-[#11152B] hover:bg-[#F6F7FB]'
                      : 'text-[#62677A] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {isCompleted && !isActive ? (
                      <span className="w-4 h-4 rounded-full bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#38D9F9]' : 'text-[#62677A]'}`} />
                    )}
                  </div>

                  <span>{lang === 'ar' ? stage.labelAr : stage.labelEn}</span>
                </button>

                {idx < STAGES.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-[#E3E6EF] shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
