import { forwardRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

interface AuthInputProps extends ComponentProps<'input'> {
  /** A problem to tell without a line of text: a red icon on the right of the field, with this text in a tooltip and for screen readers. */
  warning?: string;
}

/**
 * Input of the login/register pages: no border, line or background (not even focused), red text when `aria-invalid`, text 20px, and for
 * `type="password"` a button on the right that shows or hides the password, visible only while the field is hovered or focused (always on touch screens). Put it inside a `FormField`.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ type, className, warning, ...props }, ref) => {
    const [shown, setShown] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="group relative">
        <Input
          ref={ref}
          type={isPassword && shown ? 'text' : type}
          className={cn(
            'h-11 border-0 bg-transparent px-0 text-[20px] text-foreground placeholder:text-foreground/50 focus-visible:ring-0 aria-invalid:text-destructive',
            (isPassword || warning) && 'pr-12',
            className
          )}
          {...props}
        />
        {warning && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span role="img" aria-label={warning} tabIndex={0} className="absolute right-0 top-0 flex size-11 items-center justify-center text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <CircleAlert className="size-5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{warning}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isPassword && (
          <button
            type="button"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
            className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
    );
  }
);
AuthInput.displayName = 'AuthInput';
