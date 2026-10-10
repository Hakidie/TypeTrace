import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Individual digit OTP input boxes.
 * Handles paste, backspace navigation, and auto-focus.
 */
export function OtpInput({ length = 6, value, onChange, className }: OtpInputProps) {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const focusInput = (index: number) => {
    inputsRef.current[index]?.focus();
  };

  const handleChange = (index: number, char: string) => {
    // Only allow digits
    if (char && !/^\d$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join('').slice(0, length);
    onChange(newValue);

    // Auto-advance to next input
    if (char && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        handleChange(index, '');
      } else if (index > 0) {
        handleChange(index - 1, '');
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      focusInput(Math.min(pasted.length, length - 1));
    }
  };

  return (
    <div className={cn('flex justify-center gap-2', className)}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value.slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'size-11 border border-input bg-background text-center text-lg font-semibold',
            'transition-all placeholder:text-muted-foreground',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30',
            'sm:size-12'
          )}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
