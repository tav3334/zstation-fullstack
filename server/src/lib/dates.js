// Toutes les dates sont manipulées en UTC (timezone de l'ancienne app Laravel : 'UTC').

const DAY = 86_400_000;

export function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // "2026-10-22" ou "2026-10-22 10:00[:00]" sans fuseau → UTC (comme Carbon::parse)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) {
      return new Date(`${value.replace(' ', 'T')}Z`);
    }
  }
  return new Date(value);
}

export const isValidDate = (value) => value != null && !Number.isNaN(parseDate(value).getTime());

export function startOfDay(date = new Date()) {
  const d = parseDate(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const endOfDay = (date = new Date()) => new Date(startOfDay(date).getTime() + DAY - 1);
export const addDays = (date, n) => new Date(parseDate(date).getTime() + n * DAY);
export const addMinutes = (date, n) => new Date(parseDate(date).getTime() + n * 60_000);

export function addMonths(date, n) {
  const d = new Date(parseDate(date));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

export const today = () => startOfDay();

/** "YYYY-MM-DD" */
export const toDateString = (date) => parseDate(date).toISOString().slice(0, 10);

/** Bornes d'une journée pour reproduire whereDate('col', $date). */
export function dayRange(date) {
  const start = startOfDay(date);
  return { gte: start, lt: addDays(start, 1) };
}

/** whereDate('col', '>=', $from) / whereDate('col', '<=', $to) */
export function dateBetween(from, to) {
  const range = {};
  if (from != null) range.gte = startOfDay(from);
  if (to != null) range.lt = addDays(startOfDay(to), 1);
  return range;
}

/** Différence signée en jours entiers entre deux dates (début de journée), comme diffInDays(..., false). */
export const diffInDays = (from, to) => Math.trunc((startOfDay(to) - startOfDay(from)) / DAY);

const pad = (n) => String(n).padStart(2, '0');

/** 'H:i' */
export function formatTime(date) {
  const d = parseDate(date);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 'd/m/Y' */
export function formatDate(date) {
  const d = parseDate(date);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** 'Y-m-d H:i:s' (toDateTimeString) */
export function formatDateTime(date) {
  const d = parseDate(date);
  return `${toDateString(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
