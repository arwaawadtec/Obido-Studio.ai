import React, { useState } from 'react';
import { Video, ArrowRight, Loader2, Shield, Sparkles } from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';
import { AppError } from '../../types/error';
import { GlobalErrorCard } from '../common/GlobalErrorCard';
import { PasswordInput } from '../common/PasswordInput';
import { createAppError } from '../../services/errorService';

export const SignUpPage: React.FC = () => {
  const lang = storage.getLanguagePreference();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorObj, setErrorObj] = useState<AppError | null>(null);

  const handleSubmit = async (e: React.FormEvent, forceSandbox = false) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!name.trim()) {
      setErrorObj(
        createAppError({
          code: 'VALIDATION_ERROR',
          message: lang === 'ar' ? 'الرجاء إدخال اسمك الكامل' : 'Please provide your full name or creator handle.',
          field: 'name',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Name validation check',
          whereFailed: 'Registration form (Name input)',
          whyFailed: 'The name field was left blank.',
          whatToDoNext: 'Enter your name or creator handle to proceed.',
        })
      );
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorObj(
        createAppError({
          code: 'VALIDATION_ERROR',
          message: lang === 'ar' ? 'الرجاء إدخال بريد إلكتروني صالح' : 'Please enter a valid email address.',
          field: 'email',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Email address validation check',
          whereFailed: 'Registration form (Email input)',
          whyFailed: 'The email address is missing or has an invalid structure.',
          whatToDoNext: 'Check for typos and enter a valid email address.',
        })
      );
      return;
    }
    if (password.length < 6) {
      setErrorObj(
        createAppError({
          code: 'VALIDATION_ERROR',
          message: lang === 'ar' ? 'كلمة المرور يجب أن لا تقل عن 6 أحرف' : 'Password must be at least 6 characters.',
          field: 'password',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Password security length check',
          whereFailed: 'Registration form (Password input)',
          whyFailed: 'The password is fewer than 6 characters.',
          whatToDoNext: 'Enter a password with at least 6 characters and retry.',
        })
      );
      return;
    }
    if (!agreeTerms) {
      setErrorObj(
        createAppError({
          code: 'TERMS_REQUIRED',
          message: lang === 'ar' ? 'يجب الموافقة على شروط الاستخدام' : 'Please agree to the Terms of Service.',
          field: 'terms',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Terms acceptance check',
          whereFailed: 'Registration form (Terms checkbox)',
          whyFailed: 'Terms of service agreement was not checked.',
          whatToDoNext: 'Check the agreement box to accept terms and create your account.',
        })
      );
      return;
    }

    setLoading(true);
    setErrorObj(null);

    const res = await auth.signUp(name, email, password, { forceSandbox });
    setLoading(false);

    if (res.success && res.user) {
      // New users must always complete onboarding
      router.navigate('/onboarding');
    } else if (res.error) {
      setErrorObj(res.error);
    } else {
      setErrorObj(
        createAppError({
          code: 'UNKNOWN_REGISTRATION_ERROR',
          message: res.errorMessage || 'Failed to create account.',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Account creation',
          whereFailed: 'Registration service',
          whyFailed: res.errorMessage || 'Unknown system error occurred.',
          whatToDoNext: 'Retry your registration or use the Development Sandbox mode.',
        })
      );
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setErrorObj(null);
    const res = await auth.signInWithGoogle();
    setLoading(false);

    if (res.success && res.user) {
      if (!res.user.hasCompletedOnboarding) {
        router.navigate('/onboarding');
      } else {
        router.navigate('/app');
      }
    } else if (res.error) {
      setErrorObj(res.error);
    } else {
      setErrorObj(
        createAppError({
          code: 'GOOGLE_SIGNUP_FAILED',
          message: res.errorMessage || 'Google sign-up failed.',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Google sign-up authentication',
          whereFailed: 'Google OAuth flow',
          whyFailed: res.errorMessage || 'Sign-in window closed or unverified.',
          whatToDoNext: 'Try Google sign-up again or create an account with email.',
        })
      );
    }
  };

  const handleAction = (actionType: string) => {
    if (actionType === 'sandbox_mode') {
      handleSubmit({ preventDefault: () => {} } as any, true);
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
          {lang === 'ar' ? 'إنشاء حساب جديد في الاستوديو' : 'Create your creator account'}
        </h2>
        <p className="text-xs text-[#62677A]">
          {lang === 'ar'
            ? 'ابدأ إنتاج أول فيديو لك مع التحكم الكامل في المشاهد'
            : 'Initialize your studio workspace with production-grade workflows'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[#E3E6EF] rounded-2xl shadow-sm space-y-6">
          {/* Provider Transparency Banner */}
          <div className="p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg flex items-start gap-2.5 text-[11px] text-[#62677A]">
            <Shield className="w-3.5 h-3.5 text-[#635BFF] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-[#11152B] block">
                {auth.isFirebaseConfigured() ? 'Cloud Authentication Active' : 'Development Auth Sandbox Active'}
              </span>
              <p>
                {auth.isFirebaseConfigured()
                  ? 'Real Firebase Authentication and per-user Firestore isolation connected.'
                  : 'Secure local authentication sandbox without exposing plaintext secrets.'}
              </p>
            </div>
          </div>

          {/* 4-Part Global Error Card */}
          {errorObj && (
            <GlobalErrorCard
              error={errorObj}
              onRetry={() => handleSubmit({ preventDefault: () => {} } as any)}
              onAction={handleAction}
              onDismiss={() => setErrorObj(null)}
              lang={lang}
            />
          )}

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الاسم الكامل أو اسم القناة/الشركة' : 'Full Name or Creator Handle'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-lg focus:outline-none transition-colors ${
                  errorObj?.field === 'name' ? 'border-rose-400 focus:border-rose-500' : 'border-[#E3E6EF] focus:border-[#635BFF]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-lg focus:outline-none transition-colors ${
                  errorObj?.field === 'email' ? 'border-rose-400 focus:border-rose-500' : 'border-[#E3E6EF] focus:border-[#635BFF]'
                }`}
              />
            </div>

            <div>
              <PasswordInput
                id="signup-password"
                name="password"
                label={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoComplete="new-password"
                error={errorObj?.field === 'password'}
                showToggleAriaLabel="Show password"
                hideToggleAriaLabel="Hide password"
              />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 rounded text-[#635BFF] focus:ring-0 accent-[#635BFF]"
              />
              <label htmlFor="terms" className="text-xs text-[#62677A] leading-tight cursor-pointer">
                {lang === 'ar' ? 'أوافق على شروط الاستخدام وسياسة الخصوصية الخاصة بـ Obido Studio' : 'I agree to the Terms of Service and Privacy Policy'}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.99] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ الإنشاء...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'ar' ? 'إنشاء الحساب ومتابعة الإعداد' : 'Create Account & Continue'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Social Sign-in Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E3E6EF]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-[#62677A]">or sign up with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google Creator Account</span>
          </button>
        </div>

        <p className="text-center text-xs text-[#62677A] mt-6">
          {lang === 'ar' ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
          <button
            onClick={() => router.navigate('/sign-in')}
            className="font-semibold text-[#635BFF] hover:underline"
          >
            {lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};
