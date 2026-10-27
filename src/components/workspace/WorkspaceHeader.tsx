import React from 'react';
import {
  FileText,
  AlignLeft,
  Layers,
  Film,
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
  Sparkles,
  Cloud,
  Database,
  Loader2,
} from 'lucide-react';
import { Project, WorkflowStage } from '../../types';
import { storage } from '../../services/storage';

interface WorkspaceHeaderProps {
  project: Project;
  currentStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
  onBackToDashboard: () => void;
  isNovaOpen?: boolean;
  onToggleNova?: () => void;
}

const STAGES: { id: WorkflowStage; labelEn: string; labelAr: string; icon: any }[] = [
  { id: 'brief', labelEn: '1. Brief', labelAr: '1. الملخص', icon: FileText },
  { id: 'script', labelEn: '2. Script', labelAr: '2. السيناريو', icon: AlignLeft },
  { id: 'scenes', labelEn: '3. Scenes', labelAr: '3. المشاهد', icon: Layers },
  { id: 'shots', labelEn: '4. Shot List', labelAr: '4. اللقطات', icon: Film },
  { id: 'storyboard', labelEn: '5. Storyboard', labelAr: '5. لوحة القصة', icon: LayoutGrid },
  { id: 'prompts', labelEn: '6. Prompts', labelAr: '6. الموجهات', icon: Terminal },
  { id: 'assets', labelEn: '7. Assets', labelAr: '7. الوسائط', icon: FolderOpen },
  { id: 'generation', labelEn: '8. Generation', labelAr: '8. التوليد', icon: Cpu },
  { id: 'editing', labelEn: '9. Editing', labelAr: '9. المونتاج', icon: Sliders },
  { id: 'export', labelEn: '10. Export', labelAr: '10. التصدير', icon: Share2 },
];

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  project,
  currentStage,
  onSelectStage,
  onBackToDashboard,
  isNovaOpen,
  onToggleNova,
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

  const syncStatus = project.cloudSyncStatus || (project.isLocalOnly ? 'local_only' : 'synced');
  const completedCount = project.completedStages?.length || 0;

  return (
    <div className="w-full bg-white border-b border-[#E3E6EF]">
      {/* Top Breadcrumb & Metadata Row */}
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E3E6EF]/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs text-[#62677A] hover:text-[#11152B] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'الرئيسية' : 'Dashboard'}</span>
          </button>

          <span className="text-[#E3E6EF]">/</span>

          <h1 className="text-sm font-bold text-[#11152B] truncate max-w-[240px] sm:max-w-xs md:max-w-md">
            {project.title}
          </h1>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#62677A]">
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.brief.aspectRatio}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.brief.targetDurationSeconds}s</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{project.brief.visualStyle.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Right Project Actions & Genuine Sync Status */}
        <div className="flex items-center gap-2">
          {onToggleNova && (
            <button
              onClick={onToggleNova}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                isNovaOpen
                  ? 'bg-[#111318] text-white border-[#242833] shadow-sm'
                  : 'bg-[#635BFF]/10 text-[#635BFF] hover:bg-[#635BFF]/15 border-[#635BFF]/20'
              }`}
              title={lang === 'ar' ? 'المساعد الفني نوفا' : 'Nova AI Production Assistant'}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#38D9F9]" />
              <span>Nova AI</span>
            </button>
          )}

          {/* Genuine Sync State Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium mr-1 px-2 py-1 rounded bg-[#F6F7FB] border border-[#E3E6EF]">
            {syncStatus === 'synced' ? (
              <span className="flex items-center gap-1 text-[#16A34A]">
                <Check className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'متزامن سحابياً' : 'Cloud Synced'}</span>
              </span>
            ) : syncStatus === 'pending' ? (
              <span className="flex items-center gap-1 text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{lang === 'ar' ? 'جاري المزامنة...' : 'Syncing...'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#62677A]">
                <Database className="w-3 h-3" />
                <span>{lang === 'ar' ? 'محفوظ محلياً' : 'Local Sandbox'}</span>
              </span>
            )}

            <span className="text-[#CBD1E1]">•</span>

            <span className="text-[#62677A] font-mono text-[10px]">
              {completedCount}/10 {lang === 'ar' ? 'مكتمل' : 'done'}
            </span>
          </div>

          <button
            onClick={handleExportJSON}
            title={lang === 'ar' ? 'تصدير بيانات المشروع JSON' : 'Export Project JSON'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded-md border border-[#E3E6EF] transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            onClick={handleDelete}
            title={lang === 'ar' ? 'حذف المشروع' : 'Delete Project'}
            className="p-1.5 text-[#62677A] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 10-Stage Canonical Production Stepper */}
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
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#11152B] text-white shadow-xs'
                      : isCompleted
                      ? 'text-[#11152B] hover:bg-[#F6F7FB]'
                      : 'text-[#62677A] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {isCompleted && !isActive ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center text-[9px] font-bold">
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
