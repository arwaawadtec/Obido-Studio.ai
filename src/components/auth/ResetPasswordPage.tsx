import React, { useState, useEffect } from 'react';
import { Video, ArrowRight, Loader2, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';
import { AppError } from '../../types/error';
import { GlobalErrorCard } from '../common/GlobalErrorCard';
import { PasswordInput } from '../common/PasswordInput';
import { createAppError } from '../../services/errorService';

interface ResetPasswordPageProps {
  oobCode?: string;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ oobCode: propCode }) => {
  const lang = storage.getLanguagePreference();

  // Extract oobCode from prop or URL query parameter
  const getInitialCode = () => {
    if (propCode) return propCode;
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      return params.get('oobCode') || '';
    }
    return '';
  };

  const actionCode = getInitialCode();

  const [verifyingCode, setVerifyingCode] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorObj, setErrorObj] = useState<AppError | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);

  // Verify action code on mount
  useEffect(() => {
    let isMounted = true;

    async function checkCode() {
      if (!actionCode) {
        if (isMounted) {
          setVerifyingCode(false);
          setErrorObj(
            createAppError({
              code: 'MISSING_ACTION_CODE',
              message: lang === 'ar' ? 'رابط استعادة كلمة المرور غير صالح أو ينقصه الرمز' : 'Password reset link is invalid or missing the security token.',
              stage: 'auth',
              retryable: false,
              whatFailed: 'Password recovery verification',
              whereFailed: 'URL security token parameter',
              whyFailed: 'The reset link does not contain a valid security action code (oobCode).',
              whatToDoNext: 'Request a fresh password recovery email from the Forgot Password page.',
              action: {
                label: 'Request New Reset Link',
                actionType: 'reset_password',
                target: '/forgot-password',
              },
            })
          );
        }
        return;
      }

      setVerifyingCode(true);
      setErrorObj(null);

      const res = await auth.verifyResetCode(actionCode);
      if (isMounted) {
        setVerifyingCode(false);
        if (res.success && res.email) {
          setVerifiedEmail(res.email);
        } else {
          setErrorObj(res.error || null);
        }
      }
    }

    checkCode();

    return () => {
      isMounted = false;
    };
  }, [actionCode, lang]);

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setErrorObj(
        createAppError({
          code: 'WEAK_PASSWORD',
          message: lang === 'ar' ? 'كلمة المرور يجب أن لا تقل عن 6 أحرف' : 'Password must be at least 6 characters long.',
          field: 'newPassword',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Password policy length check',
          whereFailed: 'New password input',
          whyFailed: 'The entered password is shorter than 6 characters.',
          whatToDoNext: 'Enter a password with 6 or more characters and retry.',
        })
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorObj(
        createAppError({
          code: 'PASSWORD_MISMATCH',
          message: lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match. Please ensure both fields are identical.',
          field: 'confirmPassword',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Password confirmation match check',
          whereFailed: 'Confirm password input',
          whyFailed: 'The confirmation password does not match the new password entered.',
          whatToDoNext: 'Re-type your password in both fields to ensure they match.',
        })
      );
      return;
    }

    setSubmitting(true);
    setErrorObj(null);

    const res = await auth.confirmPasswordReset(actionCode, newPassword);
    setSubmitting(false);

    if (res.success) {
      setResetCompleted(true);
    } else {
      setErrorObj(res.error || null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
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
          {lang === 'ar' ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}
        </h2>
        <p className="text-xs text-[#62677A]">
          {verifiedEmail
            ? lang === 'ar'
              ? `إعادة تعيين الحساب المسجل: ${verifiedEmail}`
              : `Resetting credentials for: ${verifiedEmail}`
            : lang === 'ar'
            ? 'أدخل كلمة المرور الجديدة لحسابك'
            : 'Enter a strong replacement password for your account'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[#E3E6EF] rounded-2xl shadow-sm space-y-6">
          {/* State 1: Verifying action code */}
          {verifyingCode && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 text-[#635BFF] animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#11152B]">
                  {lang === 'ar' ? 'جارٍ التحقق من رابط الاستعادة...' : 'Verifying password reset security link...'}
                </p>
                <p className="text-[11px] text-[#62677A]">
                  Validating single-use cryptographic token with Firebase Authentication.
                </p>
              </div>
            </div>
          )}

          {/* State 2: Error verifying or submitting */}
          {errorObj && (
            <GlobalErrorCard
              error={errorObj}
              onRetry={() => {
                setErrorObj(null);
              }}
              lang={lang}
            />
          )}

          {/* State 3: Reset completed successfully */}
          {resetCompleted && (
            <div className="space-y-5 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-[#11152B]">
                  {lang === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password Updated Successfully'}
                </h3>
                <p className="text-xs text-[#62677A] max-w-sm mx-auto leading-relaxed">
                  {lang === 'ar'
                    ? 'تم حفظ كلمة المرور الجديدة في السحابة. يمكنك الآن تسجيل الدخول والمتابعة إلى مشاريعك.'
                    : 'Your new password has been verified and updated in Firebase Authentication. You can now sign in with your new credentials.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.navigate('/sign-in')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.99] rounded-lg shadow-sm transition-all"
                >
                  <span>{lang === 'ar' ? 'تسجيل الدخول الآن' : 'Sign In Now'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* State 4: Verified code - Show New Password Form */}
          {!verifyingCode && !resetCompleted && verifiedEmail && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account badge */}
              <div className="p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg flex items-center gap-2.5 text-xs text-[#11152B]">
                <ShieldCheck className="w-4 h-4 text-[#635BFF] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#62677A] block tracking-wider">
                    Verified Account
                  </span>
                  <span className="font-mono text-xs font-semibold truncate block">
                    {verifiedEmail}
                  </span>
                </div>
              </div>

              {/* New Password with Show/Hide toggle */}
              <div>
                <PasswordInput
                  id="new-password"
                  name="newPassword"
                  label={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                  error={passwordTooShort}
                  helperText={
                    passwordTooShort
                      ? 'Password must be at least 6 characters'
                      : 'Must be at least 6 characters'
                  }
                  showToggleAriaLabel="Show new password"
                  hideToggleAriaLabel="Hide new password"
                />
              </div>

              {/* Confirm Password with Show/Hide toggle */}
              <div>
                <PasswordInput
                  id="confirm-password"
                  name="confirmPassword"
                  label={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm New Password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                  error={passwordsMismatch}
                  helperText={
                    passwordsMismatch
                      ? 'Passwords do not match'
                      : passwordsMatch
                      ? '✓ Passwords match'
                      : undefined
                  }
                  showToggleAriaLabel="Show confirm password"
                  hideToggleAriaLabel="Hide confirm password"
                />
              </div>

              {/* Real-time Match Indicator Badge */}
              {confirmPassword.length > 0 && (
                <div
                  className={`text-xs p-2 rounded-lg flex items-center gap-2 transition-colors ${
                    passwordsMatch
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="font-medium text-[11px]">
                    {passwordsMatch
                      ? 'Passwords match perfectly.'
                      : 'Passwords do not match yet.'}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !passwordsMatch || newPassword.length < 6}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.99] rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ar' ? 'جارٍ تحديث كلمة المرور...' : 'Updating Password...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Action to Return to Sign In if code was invalid */}
          {!verifyingCode && !verifiedEmail && !resetCompleted && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => router.navigate('/forgot-password')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[#11152B] bg-[#F6F7FB] border border-[#E3E6EF] hover:bg-white transition-colors"
              >
                <span>Request a new password reset email</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#62677A] mt-6">
          <button
            onClick={() => router.navigate('/sign-in')}
            className="font-semibold text-[#635BFF] hover:underline"
          >
            {lang === 'ar' ? 'الرجوع إلى تسجيل الدخول' : 'Back to Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};
