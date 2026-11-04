import { formatEuro } from "@myminijob/core";
export const euro = (cents: number) => formatEuro(cents);
export const perHour = (cents: number) => `${formatEuro(cents)}/Std.`;
export const date = (d: string | Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
export const dateTime = (d: string | Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
export function relative(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  if (diff < 86400 * 7) return `vor ${Math.floor(diff / 86400)} Tag${diff < 172800 ? "" : "en"}`;
  return date(d);
}
