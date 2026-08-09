import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'bg-surface-alt text-foreground border border-border hover:bg-surface',
  danger: 'bg-error text-white hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-surface-alt',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-opacity duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
