import React, { useState } from 'react';
import { Video, ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';

export const ForgotPasswordPage: React.FC = () => {
  const lang = storage.getLanguagePreference();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(lang === 'ar' ? 'الرجاء إدخال بريد إلكتروني صالح' : 'Please provide a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await auth.requestPasswordReset(email);
    setLoading(false);
    setSubmitted(true);
    setMsg(res.message);
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.navigate('/sign-in')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'العودة لتسجيل الدخول' : 'Return to Sign In'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-xs text-[#DC2626] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
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
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none transition-colors"
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
