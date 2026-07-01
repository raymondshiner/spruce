import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-ink/30 border-t-ink',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', busy, className, children, disabled, ...props },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold transition-colors disabled:cursor-not-allowed select-none';
  const variants: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover disabled:bg-primary-muted',
    secondary:
      'bg-surface text-ink border border-border hover:border-accent/60 disabled:opacity-50',
    ghost: 'bg-transparent text-accent hover:text-ink px-2 py-2 rounded-lg',
    danger: 'bg-transparent text-danger hover:bg-danger-surface',
  };
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], className)}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <Spinner /> : children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-border bg-surface px-4 py-4 text-base text-ink',
          'placeholder:text-ink-subtle outline-none focus:border-accent',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-ink',
          'placeholder:text-ink-subtle outline-none focus:border-accent',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-surface p-4', className)}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{children}</p>
  );
}

export function Screen({
  title,
  onBack,
  right,
  padBottom,
  children,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  padBottom?: boolean; // reserve space for the fixed bottom tab bar
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto flex min-h-dvh w-full max-w-md flex-col', padBottom && 'pb-24')}>
      {(title || onBack) && (
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-bg/90 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))]">
          {onBack && (
            <button
              onClick={onBack}
              className="-ml-2 rounded-lg p-2 text-accent hover:text-ink"
              aria-label="Back"
            >
              ‹
            </button>
          )}
          {title && <h1 className="text-lg font-bold">{title}</h1>}
          <div className="ml-auto">{right}</div>
        </header>
      )}
      {children}
    </div>
  );
}
