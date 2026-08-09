import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string;
  error?: string;
}

/**
 * Labelled input with persistent helper text and error below the field.
 * Labels are always visible — never placeholder-only.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helper, error, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(helper ? helperId : undefined, error ? errorId : undefined) || undefined}
        className={cn(
          'min-h-[44px] rounded-md border bg-surface px-3 text-base text-foreground',
          'placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...props}
      />
      {helper && !error && (
        <p id={helperId} className="text-xs text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
});
