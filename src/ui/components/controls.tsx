// Buttons, toggle, segmented control, keycaps, tooltips, panels and skeletons (DESIGN.md Components).
// Styled by src/ui/components.css; no default library styling ships.

import { m } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { SPRING_SNAPPY } from './motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  block?: boolean;
}

export function Button({ variant = 'secondary', block, className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'cl-btn',
        variant === 'primary' && 'cl-btn--primary',
        variant === 'ghost' && 'cl-btn--ghost',
        block && 'cl-btn--block',
        className,
      )}
      {...rest}
    />
  );
}

export function Keycap({ children, pressed }: { children: ReactNode; pressed?: boolean }) {
  return <kbd className={cn('cl-key', pressed && 'is-pressed')}>{children}</kbd>;
}

/** A row of keycaps for a chord such as Alt Shift C. */
export function Keys({ keys, pressed }: { keys: readonly string[]; pressed?: string | null }) {
  return (
    <span className="cl-keys">
      {keys.map((k) => (
        <Keycap key={k} pressed={pressed === k}>
          {k}
        </Keycap>
      ))}
    </span>
  );
}

/** Tooltip wrapper: shows the label (and an optional key) after 500ms hover, at once on focus. */
export function Tip({
  label,
  keys,
  children,
}: {
  label: string;
  keys?: string;
  children: ReactNode;
}) {
  return (
    <span className="cl-tipwrap">
      {children}
      <span className="cl-tip" aria-hidden>
        {label}
        {keys ? <Keycap>{keys}</Keycap> : null}
      </span>
    </span>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  keys?: string;
  done?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  keys,
  done,
  children,
  className,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <Tip label={label} keys={keys}>
      <button
        type={type ?? 'button'}
        className={cn('cl-iconbtn', className)}
        aria-label={label}
        data-done={done ? 'true' : undefined}
        {...rest}
      >
        {children}
      </button>
    </Tip>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, id, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="cl-toggle"
      onClick={() => {
        onChange(!checked);
      }}
    >
      <m.span
        className="cl-toggle__thumb"
        initial={false}
        animate={{ x: checked ? 14 : 0 }}
        transition={SPRING_SNAPPY}
      />
    </button>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: SegmentedProps<T>) {
  return (
    <div className="cl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => {
            onChange(o.value);
          }}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value);
            const step =
              e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                  ? -1
                  : 0;
            if (!step) return;
            e.preventDefault();
            const next = options[(i + step + options.length) % options.length];
            if (next) onChange(next.value);
          }}
          tabIndex={o.value === value ? 0 : -1}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface PanelProps {
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Panel({ tone = 'neutral', icon, title, children, action }: PanelProps) {
  return (
    <div className={cn('cl-panel', tone !== 'neutral' && `cl-panel--${tone}`)}>
      <div className="cl-panel__head">
        {icon}
        <div>
          {title ? (
            <p className="cl-panel__title" style={{ fontWeight: 500 }}>
              {title}
            </p>
          ) : null}
          <p>{children}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function Skeleton({
  w,
  h,
  className,
}: {
  w?: number | string;
  h: number;
  className?: string;
}) {
  return (
    <div
      className={cn('cl-skel', className)}
      style={{ width: w ?? '100%', height: h }}
      aria-hidden
    />
  );
}
