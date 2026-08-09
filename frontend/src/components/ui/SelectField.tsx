import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helper?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

/** Labelled select with visible label and error below the control. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, helper, error, options, placeholder, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'min-h-[44px] rounded-md border bg-surface px-3 text-base text-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {helper && !error && <p className="text-xs text-muted">{helper}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
});
