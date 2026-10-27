import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Plus,
  Globe,
  Settings,
  HelpCircle,
  Layers,
  Sparkles,
  LogOut,
  User as UserIcon,
  Home,
  ChevronDown,
  Film,
} from 'lucide-react';
import { storage } from '../../services/storage';
import { auth } from '../../services/auth';
import { router } from '../../services/router';

interface NavbarProps {
  currentPath: string;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  activeProjectTitle?: string;
  activeProjectId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onOpenCreateModal,
  onOpenSettings,
  onOpenHelp,
  activeProjectTitle,
  activeProjectId,
}) => {
  const lang = storage.getLanguagePreference();
  const currentUser = auth.getCurrentUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLang = () => {
    const next = lang === 'en' ? 'ar' : 'en';
    storage.setLanguagePreference(next);
  };

  const handleSignOut = () => {
    auth.signOut();
    setUserMenuOpen(false);
    router.navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E3E6EF] px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.navigate('/app')}
            className="flex items-center gap-2.5 text-left group focus-visible:outline-none cursor-pointer"
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

          {activeProjectTitle && currentPath.includes('/workspace') && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-[#62677A] pl-3 border-l border-[#E3E6EF]">
              <span className="text-[#171A2B] font-medium max-w-[200px] truncate">
                {activeProjectTitle}
              </span>
            </div>
          )}

          {activeProjectTitle && activeProjectId && !currentPath.includes('/workspace') && (
            <button
              onClick={() => router.navigate(`/app/workspace/${activeProjectId}`)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#635BFF] bg-[#635BFF]/10 hover:bg-[#635BFF]/15 border border-[#635BFF]/25 rounded-md transition-colors cursor-pointer group"
              title={lang === 'ar' ? 'العودة إلى المشروع النشط ومواصلة الإنتاج' : 'Return to Active Project'}
            >
              <Film className="w-3.5 h-3.5 text-[#635BFF]" />
              <span className="text-[#11152B] font-semibold max-w-[140px] truncate">{activeProjectTitle}</span>
              <span className="text-[#635BFF] group-hover:translate-x-0.5 transition-transform font-bold">→</span>
            </button>
          )}
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#62677A]">
          <button
            onClick={() => router.navigate('/app')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentPath === '/app' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
          </button>

          <button
            onClick={() => router.navigate('/app/projects')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentPath === '/app/projects' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'المشاريع' : 'My Projects'}
          </button>

          <button
            onClick={() => router.navigate('/app/templates')}
            className={`whitespace-nowrap transition-colors hover:text-[#11152B] ${
              currentPath === '/app/templates' ? 'text-[#635BFF] font-semibold' : ''
            }`}
          >
            {lang === 'ar' ? 'القوالب' : 'Blueprints'}
          </button>

          <button
            onClick={onOpenHelp}
            className="whitespace-nowrap transition-colors hover:text-[#11152B]"
          >
            {lang === 'ar' ? 'دليل الإنتاج' : 'Production Guide'}
          </button>
        </nav>

        {/* Zone 3: Actions & User Account */}
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

          {/* Primary Create Video Action */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.98] rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{lang === 'ar' ? 'مشروع جديد' : 'Create Video'}</span>
          </button>

          {/* Authenticated User Menu */}
          {currentUser && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#F6F7FB] transition-colors focus:outline-none"
              >
                <div className="w-7 h-7 rounded-full bg-[#11152B] text-white flex items-center justify-center text-xs font-bold font-mono">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#62677A]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E3E6EF] rounded-xl shadow-lg py-2 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-[#E3E6EF] space-y-0.5">
                    <span className="font-bold text-[#11152B] block truncate">{currentUser.name}</span>
                    <span className="text-[11px] text-[#62677A] block truncate">{currentUser.email}</span>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-mono font-bold text-[#635BFF] bg-[#635BFF]/10 px-1.5 py-0.5 rounded">
                        {currentUser.tier} Plan
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          currentUser.authType === 'cloud'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {currentUser.authType === 'cloud' ? 'Cloud Auth' : 'Demo Sandbox'}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.navigate('/app');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#F6F7FB] flex items-center gap-2 text-[#171A2B]"
                    >
                      <Film className="w-3.5 h-3.5 text-[#62677A]" />
                      <span>Studio Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.navigate('/');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#F6F7FB] flex items-center gap-2 text-[#171A2B]"
                    >
                      <Home className="w-3.5 h-3.5 text-[#62677A]" />
                      <span>Public Landing Page</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#F6F7FB] flex items-center gap-2 text-[#171A2B]"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#62677A]" />
                      <span>Settings & AI Providers</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-[#E3E6EF]">
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 hover:bg-[#DC2626]/5 text-[#DC2626] font-semibold flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
