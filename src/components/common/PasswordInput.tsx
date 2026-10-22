import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: boolean;
  helperText?: string;
  showToggleAriaLabel?: string;
  hideToggleAriaLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error = false,
      helperText,
      value,
      onChange,
      placeholder = '••••••••',
      className = '',
      id,
      name = 'password',
      autoComplete = 'current-password',
      disabled = false,
      required = false,
      showToggleAriaLabel = 'Show password',
      hideToggleAriaLabel = 'Hide password',
      ...restProps
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const internalInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => internalInputRef.current as HTMLInputElement);

    const handleToggleVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const input = internalInputRef.current;
      if (!input) {
        setShowPassword((prev) => !prev);
        return;
      }

      // Preserve cursor position and focus across type change
      const start = input.selectionStart;
      const end = input.selectionEnd;

      setShowPassword((prev) => !prev);

      // Re-apply focus and selection cursor on next animation frame
      requestAnimationFrame(() => {
        input.focus();
        if (start !== null && end !== null) {
          try {
            input.setSelectionRange(start, end);
          } catch {}
        }
      });
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-[#11152B] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            {...restProps}
            ref={internalInputRef}
            id={id}
            name={name}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            required={required}
            className={`w-full text-xs px-3.5 py-2.5 pr-10 bg-white border rounded-lg focus:outline-none transition-colors ${
              error
                ? 'border-rose-400 focus:border-rose-500 ring-rose-500/10 focus:ring-2'
                : 'border-[#E3E6EF] focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/10'
            } ${disabled ? 'bg-[#F6F7FB] text-[#62677A] cursor-not-allowed' : 'text-[#11152B]'} ${className}`}
          />
          <button
            type="button"
            onClick={handleToggleVisibility}
            disabled={disabled}
            aria-label={showPassword ? hideToggleAriaLabel : showToggleAriaLabel}
            aria-pressed={showPassword}
            title={showPassword ? hideToggleAriaLabel : showToggleAriaLabel}
            tabIndex={0}
            className="absolute right-2.5 flex items-center justify-center p-1 rounded-md text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4 text-[#635BFF]" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4 text-[#62677A]" aria-hidden="true" />
            )}
          </button>
        </div>
        {helperText && (
          <p className={`mt-1 text-[11px] ${error ? 'text-rose-600' : 'text-[#62677A]'}`}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
