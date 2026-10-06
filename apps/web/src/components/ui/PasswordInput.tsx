import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leftIcon?: React.ReactNode;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  className = '',
  leftIcon,
  placeholder,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const { i18n } = useTranslation();
  const lang = i18n.language || 'ru';

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const getCapsWarningText = () => {
    if (lang === 'he' || lang === 'iw') return 'שימו לב: מקש Caps Lock פעיל';
    if (lang === 'ar') return 'تنبيه: زر Caps Lock مفعل';
    if (lang === 'en') return 'Warning: Caps Lock is ON';
    return 'Внимание: включен Caps Lock';
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            {leftIcon}
          </div>
        )}
        <input
          {...props}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          onKeyDown={(e) => {
            handleKeyEvent(e);
            props.onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            handleKeyEvent(e);
            props.onKeyUp?.(e);
          }}
          onFocus={(e) => {
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setCapsLockActive(false);
            props.onBlur?.(e);
          }}
          className={`w-full py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm ${
            leftIcon ? 'ltr:pl-10 rtl:pr-10' : 'ltr:pl-3.5 rtl:pr-3.5'
          } ltr:pr-11 rtl:pl-11 ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute ltr:right-2.5 rtl:left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 transition rounded-lg hover:bg-slate-800/80 focus:outline-none"
          title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {showPassword ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {capsLockActive && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in duration-150">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{getCapsWarningText()}</span>
        </div>
      )}
    </div>
  );
};
