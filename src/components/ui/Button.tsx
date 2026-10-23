import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "items-center justify-center gap-2 font-semibold rounded-xl select-none transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-strong active:bg-accent-strong shadow-card",
  secondary:
    "bg-surface text-fg border border-line-strong hover:bg-surface-2 active:bg-surface-3",
  soft: "bg-accent-soft text-accent-soft-fg hover:brightness-95 active:brightness-90",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-2 active:bg-surface-3",
  danger:
    "bg-danger-soft text-danger border border-transparent hover:brightness-95 active:brightness-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-3.5 text-sm",
  md: "h-12 px-4 text-[15px]",
  lg: "h-13 min-h-[52px] px-5 text-base",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
  iconOnly = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  iconOnly?: boolean;
} = {}) {
  const icon = iconOnly
    ? size === "sm"
      ? "w-10 px-0"
      : size === "lg"
        ? "w-13 min-w-[52px] px-0"
        : "w-12 px-0"
    : "";
  // `hidden md:inline-flex` no className precisa vencer o display base.
  const display = /(^|\s)hidden(\s|$)/.test(className) ? "" : "inline-flex";
  return `${display} ${base} ${variants[variant]} ${sizes[size]} ${icon} ${className}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  iconOnly,
  className,
  loading,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className, iconOnly })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
};

export function LinkButton({
  variant,
  size,
  iconOnly,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={buttonClass({ variant, size, className, iconOnly })}
      {...rest}
    />
  );
}
