import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  Terminal,
  Clock,
  ShieldX,
} from 'lucide-react';
import { AppError } from '../../types/error';
import { router } from '../../services/router';

interface GlobalErrorCardProps {
  error: AppError | string | null;
  onRetry?: () => void;
  onAction?: (actionType: string) => void;
  onDismiss?: () => void;
  className?: string;
  lang?: string;
}

export const GlobalErrorCard: React.FC<GlobalErrorCardProps> = ({
  error,
  onRetry,
  onAction,
  onDismiss,
  className = '',
  lang = 'en',
}) => {
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!error) return null;

  // Normalize string error to AppError
  const appError: AppError = typeof error === 'string'
    ? {
        code: 'GENERIC_ERROR',
        message: error,
        retryable: true,
        whatFailed: 'Operation requested by the user',
        whereFailed: 'Application interface',
        whyFailed: error,
        whatToDoNext: 'Verify your inputs and try again.',
      }
    : error;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    typeof appError.retryAfterSeconds === 'number' && appError.retryAfterSeconds > 0
      ? appError.retryAfterSeconds
      : 0
  );

  useEffect(() => {
    if (typeof appError.retryAfterSeconds === 'number' && appError.retryAfterSeconds > 0) {
      setSecondsRemaining(appError.retryAfterSeconds);
    } else {
      setSecondsRemaining(0);
    }
  }, [appError.retryAfterSeconds, appError.requestId]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleCopyRequestId = () => {
    if (appError.requestId) {
      navigator.clipboard.writeText(appError.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleActionClick = () => {
    if (!appError.action) return;

    if (onAction) {
      onAction(appError.action.actionType);
    }

    if (appError.action.actionType === 'sign_in') {
      router.navigate(appError.action.target || '/sign-in');
    } else if (appError.action.actionType === 'reset_password') {
      router.navigate(appError.action.target || '/forgot-password');
    } else if (appError.action.actionType === 'retry' && onRetry) {
      onRetry();
    }
  };

  const isQuota = appError.code === 'QUOTA_EXHAUSTED';
  const isCritical =
    isQuota ||
    appError.code.includes('DISABLED') ||
    appError.code.includes('DENIED') ||
    appError.code.includes('FORBIDDEN');

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-xl border ${
        isCritical ? 'bg-rose-50/90 border-rose-200' : 'bg-amber-50/80 border-amber-200'
      } p-4 text-xs transition-all shadow-sm ${className}`}
    >
      {/* Header with Code & Request ID */}
      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-black/5">
        <div className="flex flex-wrap items-center gap-2">
          {isCritical ? (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="font-mono text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-black/5 text-[#11152B]">
            {appError.code}
          </span>
          {isQuota && (
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
              {lang === 'ar' ? 'الحصة مستنفدة' : 'Daily Quota Exhausted'}
            </span>
          )}
          {appError.code === 'RATE_LIMITED' && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
              {lang === 'ar' ? 'حد الطلبات' : 'Rate Limited'}
            </span>
          )}
          {appError.stage && (
            <span className="text-[10px] font-medium text-[#62677A] bg-white/70 px-1.5 py-0.5 rounded border border-black/5">
              Stage: {appError.stage}
            </span>
          )}
        </div>

        {appError.requestId && (
          <button
            type="button"
            onClick={handleCopyRequestId}
            title="Copy Request ID for diagnostics"
            className="flex items-center gap-1 text-[10px] font-mono text-[#62677A] hover:text-[#11152B] bg-white/80 px-2 py-0.5 rounded border border-black/10 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : appError.requestId}</span>
          </button>
        )}
      </div>

      {/* Main Message */}
      <div className="py-2.5">
        <h4 className="font-semibold text-sm text-[#11152B] mb-1 leading-snug">
          {appError.message}
        </h4>
      </div>

      {/* 4-Part Diagnostic Explanation */}
      <div className="space-y-2 bg-white/80 rounded-lg p-3 border border-black/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="font-semibold text-[#11152B] block text-[10px] uppercase tracking-wider text-black/50">
              1. What Failed
            </span>
            <span className="text-[#33384B]">{appError.whatFailed}</span>
          </div>

          <div>
            <span className="font-semibold text-[#11152B] block text-[10px] uppercase tracking-wider text-black/50">
              2. Where It Failed
            </span>
            <span className="text-[#33384B]">{appError.whereFailed}</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-black/5 text-[11px]">
          <span className="font-semibold text-[#11152B] block text-[10px] uppercase tracking-wider text-black/50">
            3. Why It Failed
          </span>
          <span className="text-[#33384B] leading-relaxed">{appError.whyFailed}</span>
        </div>

        <div className="pt-1.5 border-t border-black/5 text-[11px] bg-[#635BFF]/5 -mx-3 -mb-3 p-3 rounded-b-lg">
          <span className="font-bold text-[#635BFF] block text-[10px] uppercase tracking-wider">
            4. What To Do Next
          </span>
          <span className="text-[#11152B] font-medium leading-relaxed block mt-0.5">
            {appError.whatToDoNext}
          </span>
        </div>
      </div>

      {/* Action / Recovery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-1">
        <div className="flex items-center gap-2">
          {appError.action && (
            <button
              type="button"
              onClick={handleActionClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.98] transition-all shadow-sm"
            >
              {appError.action.actionType === 'sign_in' && <KeyRound className="w-3.5 h-3.5" />}
              {appError.action.actionType === 'retry' && <RefreshCw className="w-3.5 h-3.5" />}
              <span>{appError.action.label}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {appError.retryable && onRetry && (
            secondsRemaining > 0 ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#62677A] bg-gray-100 border border-[#E3E6EF] cursor-not-allowed opacity-80"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span>
                  {lang === 'ar'
                    ? `إعادة المحاولة بعد ${secondsRemaining} ثانية`
                    : `Retry in ${secondsRemaining}s`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#62677A]" />
                <span>{lang === 'ar' ? 'إعادة المحاولة الآن' : 'Retry'}</span>
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          {appError.details && (
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-[10px] text-[#62677A] hover:text-[#11152B] underline decoration-dotted"
            >
              {showTechnicalDetails ? 'Hide technical details' : 'Show technical details'}
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[10px] text-[#62677A] hover:text-[#11152B] px-2 py-1 rounded"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Safe Technical Details */}
      {showTechnicalDetails && appError.details && (
        <div className="mt-2.5 p-2 bg-[#11152B] text-[#E3E6EF] font-mono text-[10px] rounded-lg overflow-x-auto">
          <div className="flex items-center gap-1 text-[#38D9F9] mb-1">
            <Terminal className="w-3 h-3" />
            <span>Diagnostics Safe Summary:</span>
          </div>
          <p className="whitespace-pre-wrap">{appError.details}</p>
        </div>
      )}
    </div>
  );
};
