import Link from "next/link";
import { Minus, Plus } from "lucide-react";

export { Button, LinkButton, buttonClass } from "./Button";
export { default as BottomSheet } from "./BottomSheet";
export { useToast, ToastProvider } from "./Toast";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
export function Card({
  className = "",
  children,
  as: Tag = "div",
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li" | "ul";
}) {
  return (
    <Tag
      className={`bg-surface rounded-2xl border border-line shadow-card ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Chip (filtro) — rolável horizontalmente dentro de ChipRow           */
/* ------------------------------------------------------------------ */
export function ChipRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1 snap-x ${className}`}
    >
      {children}
    </div>
  );
}

export function Chip({
  active,
  children,
  href,
  onClick,
  className = "",
}: {
  active?: boolean;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `shrink-0 snap-start inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors ${
    active
      ? "bg-fg text-bg dark:bg-accent dark:text-accent-fg"
      : "bg-surface border border-line text-fg-muted hover:bg-surface-2 active:bg-surface-3"
  } ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badge de status (texto + cor, nunca só cor)                          */
/* ------------------------------------------------------------------ */
export type Tone = "neutral" | "success" | "info" | "warning" | "danger" | "accent";

const toneCls: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent-soft-fg",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${toneCls[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const PATIENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  ativo: { label: "Ativo", tone: "success" },
  alta: { label: "Alta", tone: "info" },
  inativo: { label: "Inativo", tone: "neutral" },
};

export const APPT_STATUS: Record<string, { label: string; tone: Tone }> = {
  agendado: { label: "Agendado", tone: "accent" },
  concluido: { label: "Concluído", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  faltou: { label: "Falta", tone: "danger" },
};

/* ------------------------------------------------------------------ */
/* Avatar com iniciais                                                  */
/* ------------------------------------------------------------------ */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  /** URL (assinada) da foto; sem foto mostra as iniciais */
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const s =
    size === "sm"
      ? "w-9 h-9 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-lg"
        : size === "xl"
          ? "w-24 h-24 text-2xl"
          : "w-11 h-11 text-sm";
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={`Foto de ${name}`}
        className={`${s} shrink-0 rounded-full object-cover bg-surface-2 ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${s} shrink-0 rounded-full bg-accent-soft text-accent-soft-fg flex items-center justify-center font-bold ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                  */
/* ------------------------------------------------------------------ */
export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 md:mb-7">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <Link
            href={back}
            aria-label="Voltar"
            className="w-11 h-11 -ml-2 shrink-0 flex items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 active:bg-surface-3"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-[22px] md:text-2xl font-bold leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-fg-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estado vazio                                                         */
/* ------------------------------------------------------------------ */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-line p-6 md:p-10 text-center ${className}`}
    >
      {icon && (
        <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-accent-soft text-accent-soft-fg flex items-center justify-center">
          {icon}
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="text-sm text-fg-muted mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Stepper 48px — toque no número para digitar                          */
/* ------------------------------------------------------------------ */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
  step = 1,
  fullWidth = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  step?: number;
  /** Ocupa toda a largura do container (o número estica no meio). */
  fullWidth?: boolean;
}) {
  const btn =
    "w-12 h-12 shrink-0 flex items-center justify-center text-fg-muted hover:text-fg active:bg-surface-3 disabled:opacity-30";
  return (
    <div
      className={`${
        fullWidth ? "flex w-full" : "inline-flex"
      } items-stretch rounded-xl border border-line-strong bg-surface overflow-hidden h-12`}
    >
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className={btn}
      >
        <Minus size={20} />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          else if (e.target.value === "") onChange(min);
        }}
        className={`${
          fullWidth ? "flex-1 min-w-0" : "w-12"
        } text-center text-lg font-bold tnum bg-transparent border-x border-line focus:outline-none focus:bg-accent-soft`}
      />
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className={btn}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                 */
/* ------------------------------------------------------------------ */
export const inputCls =
  "w-full h-12 rounded-xl border border-line-strong bg-surface text-fg px-3.5 text-base md:text-sm placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-60";
export const textareaCls =
  "w-full rounded-xl border border-line-strong bg-surface text-fg px-3.5 py-3 text-base md:text-sm placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
export const labelCls = "block text-sm font-medium text-fg-muted mb-1.5";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-xs text-fg-faint mt-1">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 p-1 rounded-xl bg-surface-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
              active
                ? "bg-surface text-fg shadow-card"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAB — só no mobile; no desktop as páginas usam o botão do header      */
/* ------------------------------------------------------------------ */
export function Fab({
  href,
  onClick,
  label,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    "md:hidden fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 h-14 px-5 rounded-2xl bg-accent text-accent-fg font-semibold shadow-lg shadow-black/20 inline-flex items-center gap-2 active:scale-95 transition-transform";
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {children}
    </button>
  );
}
