import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
