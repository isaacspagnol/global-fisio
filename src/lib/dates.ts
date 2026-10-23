import { format, parseISO } from "date-fns";

/**
 * Data de hoje no fuso LOCAL em yyyy-MM-dd.
 * (`new Date().toISOString()` é UTC: à noite no Paraguai/Brasil cairia no dia seguinte.)
 */
export function todayLocalISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** yyyy-MM-dd → dd/MM/yyyy */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** yyyy-MM-dd → dd/MM */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function parseDateOnly(iso: string): Date {
  return parseISO(iso);
}
