import React, { useState } from 'react';
import { Video, ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';
import { AppError } from '../../types/error';
import { GlobalErrorCard } from '../common/GlobalErrorCard';
import { createAppError } from '../../services/errorService';

export const ForgotPasswordPage: React.FC = () => {
  const lang = storage.getLanguagePreference();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorObj, setErrorObj] = useState<AppError | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorObj(
        createAppError({
          code: 'VALIDATION_ERROR',
          message: lang === 'ar' ? 'الرجاء إدخال بريد إلكتروني صالح' : 'Please provide a valid email address.',
          field: 'email',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Email address validation check',
          whereFailed: 'Password reset form (Email input)',
          whyFailed: 'The email address is missing or has an invalid structure.',
          whatToDoNext: 'Enter a valid registered email address and try again.',
        })
      );
      return;
    }

    setLoading(true);
    setErrorObj(null);

    const res = await auth.requestPasswordReset(email);
    setLoading(false);

    if (res.success) {
      setSubmitted(true);
      setMsg(res.message);
    } else {
      setErrorObj(
        res.error ||
          createAppError({
            code: 'PASSWORD_RESET_FAILED',
            message: res.message || 'Failed to dispatch password recovery email.',
            field: 'email',
            stage: 'auth',
            retryable: true,
            whatFailed: 'Password reset dispatch',
            whereFailed: 'Authentication recovery service',
            whyFailed: res.message || 'Unknown recovery error.',
            whatToDoNext: 'Check the email address or try again in a few moments.',
          })
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <a href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-[#11152B] flex items-center justify-center text-white shadow-sm group-hover:bg-[#635BFF] transition-colors">
            <Video className="w-5 h-5 text-[#38D9F9]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#11152B] font-display">
            Obido Studio
          </span>
        </a>
        <h2 className="text-xl font-bold text-[#11152B] font-display pt-2">
          {lang === 'ar' ? 'استعادة كلمة المرور' : 'Reset your password'}
        </h2>
        <p className="text-xs text-[#62677A]">
          {lang === 'ar'
            ? 'أدخل بريدك الإلكتروني وسنرسل لك تعليمات استعادة الوصول'
            : 'Enter your email address to receive recovery instructions'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[#E3E6EF] rounded-2xl shadow-sm space-y-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#11152B]">
                  {lang === 'ar' ? 'تم إرسال التعليمات' : 'Recovery Instructions Dispatched'}
                </h3>
                <p className="text-xs text-[#62677A] leading-relaxed">
                  {msg}
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => router.navigate('/sign-in')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'العودة لتسجيل الدخول' : 'Return to Sign In'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setErrorObj(null);
                  }}
                  className="text-xs text-[#62677A] hover:text-[#11152B] underline decoration-dotted block mx-auto pt-1 cursor-pointer"
                >
                  {lang === 'ar' ? 'إرسال إلى بريد إلكتروني آخر أو إعادة المحاولة' : 'Try a different email or send again'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorObj && (
                <GlobalErrorCard
                  error={errorObj}
                  onRetry={() => handleSubmit({ preventDefault: () => {} } as any)}
                  onDismiss={() => setErrorObj(null)}
                  lang={lang}
                />
              )}

              <div>
                <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                  {lang === 'ar' ? 'البريد الإلكتروني المسجل' : 'Account Email'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-lg focus:outline-none transition-colors ${
                    errorObj?.field === 'email' ? 'border-rose-400 focus:border-rose-500' : 'border-[#E3E6EF] focus:border-[#635BFF]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ar' ? 'جارٍ المعالجة...' : 'Sending Link...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'ar' ? 'إرسال رابط الاستعادة' : 'Send Recovery Instructions'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => router.navigate('/sign-in')}
                  className="text-xs text-[#62677A] hover:text-[#11152B]"
                >
                  {lang === 'ar' ? 'الرجوع إلى تسجيل الدخول' : 'Back to Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
