import React, { useState, useEffect } from 'react';
import {
  X,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { migrationBridge, MigrationSummary } from '../../services/migrationBridge';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrationComplete,
}) => {
  const lang = storage.getLanguagePreference();
  const currentUser = auth.getCurrentUser();
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localProjects = migrationBridge.getLocalProjects();
  const pendingProjects = migrationBridge.getPendingProjects();

  useEffect(() => {
    const unsub = migrationBridge.subscribe((newSummary) => {
      setSummary(newSummary);
      if (!newSummary.inProgress && newSummary.succeeded > 0) {
        onMigrationComplete?.();
      }
    });
    return unsub;
  }, [onMigrationComplete]);

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    if (!currentUser) {
      setErrorMsg('You must be signed in with a cloud account to migrate projects.');
      return;
    }
    setErrorMsg(null);
    setIsMigrating(true);
    try {
      await migrationBridge.migrateProjects(currentUser.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Migration encountered an unexpected error.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-[#E3E6EF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-[#11152B] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#635BFF]/20 text-[#38D9F9] flex items-center justify-center">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display">
                {lang === 'ar' ? 'ترحيل المشاريع إلى التخزين السحابي' : 'Cloud Migration Bridge'}
              </h3>
              <p className="text-xs text-[#E3E6EF]/70">
                {lang === 'ar'
                  ? 'نقل المشاريع المحلية بأمان إلى Firebase Firestore و Object Storage'
                  : 'Safely transfer local browser projects to Firestore & Cloud Object Storage'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isMigrating}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Safeguard Notice */}
          <div className="p-3.5 bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl flex items-start gap-3 text-xs text-[#62677A]">
            <Shield className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-[#11152B] block">
                {lang === 'ar' ? 'ضمان سلامة البيانات' : 'Zero-Data-Loss Guarantee'}
              </span>
              <p>
                {lang === 'ar'
                  ? 'لن يتم حذف بياناتك المحلية مطلقاً. تحتفظ النسخة السحابية بالمعرفات الأصلية وترتيب المشاهد وسجل الموجهات.'
                  : 'Your local browser projects will never be deleted. Cloud migration writes verified Firestore records and preserves original project IDs, scene sequences, and prompt revisions.'}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Target Account Info */}
          <div className="p-3 border border-[#E3E6EF] rounded-lg text-xs flex items-center justify-between">
            <span className="text-[#62677A]">
              {lang === 'ar' ? 'الحساب المستهدف:' : 'Destination Account:'}
            </span>
            <span className="font-mono font-semibold text-[#11152B]">
              {currentUser?.email || (lang === 'ar' ? 'غير مسجل' : 'Not signed in')}
            </span>
          </div>

          {/* Local Projects Found */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#11152B]">
                {lang === 'ar' ? 'المشاريع المحلية المكتشفة' : 'Detected Local Projects'} ({localProjects.length})
              </span>
              <span className="text-[11px] text-[#62677A]">
                {pendingProjects.length} {lang === 'ar' ? 'في انتظار الترحيل' : 'unmigrated'}
              </span>
            </div>

            <div className="border border-[#E3E6EF] rounded-xl divide-y divide-[#E3E6EF] max-h-48 overflow-y-auto">
              {localProjects.map((p) => {
                const itemStatus = summary?.items.find((it) => it.projectId === p.id);
                return (
                  <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[#11152B] flex items-center gap-2">
                        <span>{p.title}</span>
                        {p.migratedFromLocal && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-normal">
                            Migrated
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#62677A] font-mono">
                        {p.scenes?.length || 0} scenes · {p.assets?.length || 0} assets · {p.brief?.aspectRatio}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {itemStatus?.status === 'uploading_media' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#635BFF]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading media
                        </span>
                      )}
                      {itemStatus?.status === 'saving_document' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#635BFF]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving Firestore
                        </span>
                      )}
                      {itemStatus?.status === 'verifying' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Verifying write
                        </span>
                      )}
                      {itemStatus?.status === 'succeeded' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                      {itemStatus?.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold" title={itemStatus.error}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                      {!itemStatus && (
                        <span className="text-[11px] text-[#62677A]">Ready</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results Summary if finished */}
          {summary && !summary.inProgress && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Migration Finished</span>
              </div>
              <p className="text-emerald-800">
                Successfully migrated {summary.succeeded} of {summary.total} projects to Firestore with complete verification.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F6F7FB] border-t border-[#E3E6EF] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isMigrating}
            className="px-4 py-2 text-xs font-semibold text-[#62677A] hover:text-[#11152B] transition-colors"
          >
            {summary && !summary.inProgress ? 'Close' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleStartMigration}
            disabled={isMigrating || localProjects.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isMigrating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Migrating Projects...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5" />
                <span>{summary?.failed ? 'Retry Migration' : 'Start Migration'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
