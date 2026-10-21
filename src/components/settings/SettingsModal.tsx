import React, { useState, useEffect } from 'react';
import { X, Globe, Cpu, Database, RotateCcw, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { storage } from '../../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const lang = storage.getLanguagePreference();
  const [selectedLang, setSelectedLang] = useState<'en' | 'ar'>(lang);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/health')
        .then((r) => r.json())
        .then(setHealthStatus)
        .catch(() => setHealthStatus({ hasApiKey: false, status: 'offline' }));

      fetch('/api/providers')
        .then((r) => r.json())
        .then((d) => setProviders(d.providers || []))
        .catch(() => setProviders([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLangChange = (newLang: 'en' | 'ar') => {
    setSelectedLang(newLang);
    storage.setLanguagePreference(newLang);
  };

  const handleExportAll = () => {
    const projects = storage.getProjects();
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obido_studio_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetData = () => {
    if (confirm(lang === 'ar' ? 'هل تريد استعادة بيانات المشاريع الافتراضية؟' : 'Reset all projects to default sample data?')) {
      storage.resetDemoData();
      setStatusMsg(lang === 'ar' ? 'تمت استعادة المشاريع النموذجية' : 'Demo data reset successfully');
      setTimeout(() => setStatusMsg(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white border border-[#E3E6EF] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E6EF] bg-[#F6F7FB]">
          <h2 className="text-base font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'إعدادات المنصة ومحركات الذكاء الاصطناعي' : 'Platform & AI Provider Settings'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#62677A] hover:text-[#11152B] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto light-scrollbar">
          {statusMsg && (
            <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-lg text-xs text-[#16A34A] flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Language / Localization */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>{lang === 'ar' ? 'اللغة واتجاه الواجهة (RTL / LTR)' : 'Language & Typography (RTL Support)'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleLangChange('en')}
                className={`p-3 text-left border rounded-lg transition-all ${
                  selectedLang === 'en'
                    ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                    : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                }`}
              >
                <span className="font-bold text-xs block text-[#11152B]">English (LTR)</span>
                <span className="text-[11px] text-[#62677A] mt-0.5 block">Inter & Plus Jakarta Sans</span>
              </button>

              <button
                type="button"
                onClick={() => handleLangChange('ar')}
                className={`p-3 text-right border rounded-lg transition-all ${
                  selectedLang === 'ar'
                    ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                    : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                }`}
              >
                <span className="font-bold text-xs block text-[#11152B]">العربية (RTL)</span>
                <span className="text-[11px] text-[#62677A] mt-0.5 block">IBM Plex Sans Arabic</span>
              </button>
            </div>
          </div>

          {/* AI Providers & Capabilities */}
          <div className="space-y-3 pt-4 border-t border-[#E3E6EF]">
            <h3 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#38D9F9]" />
              <span>{lang === 'ar' ? 'حالة محركات ومحولات الذكاء الاصطناعي' : 'AI Provider Adapters & Health'}</span>
            </h3>

            <div className="p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#11152B]">Google GenAI SDK (Server-Side)</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    healthStatus?.hasApiKey
                      ? 'bg-[#16A34A]/10 text-[#16A34A]'
                      : 'bg-[#D97706]/10 text-[#D97706]'
                  }`}
                >
                  {healthStatus?.hasApiKey ? 'KEY ATTACHED' : 'AWAITING KEY (FALLBACK READY)'}
                </span>
              </div>
              <p className="text-[#62677A] text-[11px] leading-relaxed">
                Uses <code className="text-[#635BFF]">gemini-3.8-flash</code> for script synthesis and scene decomposition. Video synthesis adapter routes to <code className="text-[#635BFF]">gemini-omni-1.1-flash</code>.
              </p>
            </div>
          </div>

          {/* Data & Persistence */}
          <div className="space-y-3 pt-4 border-t border-[#E3E6EF]">
            <h3 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>{lang === 'ar' ? 'إدارة البيانات والنسخ الاحتياطي' : 'Persistence & Data Management'}</span>
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportAll}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Export All Projects (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleResetData}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#62677A] hover:text-[#DC2626] bg-white border border-[#E3E6EF] hover:bg-[#DC2626]/5 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Sample Projects</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E3E6EF] bg-[#F6F7FB] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
