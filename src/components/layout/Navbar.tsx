import React, { useState, useEffect } from 'react';
import { Video, Plus, Globe, Settings, HelpCircle, Layers, FolderHeart, Sparkles } from 'lucide-react';
import { storage } from '../../services/storage';

interface NavbarProps {
  currentView: 'dashboard' | 'workspace' | 'templates';
  onNavigate: (view: 'dashboard' | 'workspace' | 'templates') => void;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  activeProjectTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenCreateModal,
  onOpenSettings,
  onOpenHelp,
  activeProjectTitle,
}) => {
  const [lang, setLang] = useState<'en' | 'ar'>(storage.getLanguagePreference());

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setLang(storage.getLanguagePreference());
    });
    return unsub;
  }, []);

  const toggleLang = () => {
    const next = lang === 'en' ? 'ar' : 'en';
    storage.setLanguagePreference(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E3E6EF] px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left group focus-visible:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-[#11152B] flex items-center justify-center text-white shadow-sm group-hover:bg-[#635BFF] transition-colors">
              <Video className="w-5 h-5 text-[#38D9F9]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#11152B] font-display whitespace-nowrap block leading-none">
                Obido Studio
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#62677A] font-mono mt-0.5 block">
                Video Creation Platform
              </span>
            </div>
          </button>

          {activeProjectTitle && currentView === 'workspace' && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-[#62677A] pl-3 border-l border-[#E3E6EF]">
              <span className="text-[#171A2B] font-medium max-w-[200px] truncate">
                {activeProjectTitle}
              </span>
            </div>
          )}
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#62677A]">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentView === 'dashboard' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
          </button>

          <button
            onClick={() => onNavigate('workspace')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentView === 'workspace' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'مساحة الإنتاج' : 'Production Workspace'}
          </button>

          <button
            onClick={() => onNavigate('templates')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentView === 'templates' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'القوالب' : 'Templates'}
          </button>

          <button
            onClick={onOpenHelp}
            className="whitespace-nowrap transition-colors hover:text-[#11152B]"
          >
            {lang === 'ar' ? 'دليل الإنتاج' : 'Production Guide'}
          </button>
        </nav>

        {/* Zone 3: Actions & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded-md transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-mono uppercase">{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
            className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded-md transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Primary Action Button */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.98] rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{lang === 'ar' ? 'مشروع جديد' : 'Create Video'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
