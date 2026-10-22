import { Prisma } from './prisma.js';

export class HttpError extends Error {
  constructor(status, body) {
    super(body?.message ?? 'Error');
    this.status = status;
    this.body = body;
  }
}

/** Interrompt la requête avec un statut et un corps JSON (string → { message }). */
export function abort(status, body) {
  throw new HttpError(status, typeof body === 'string' ? { message: body } : body);
}

/** Équivalent de findOrFail : 404 au format Laravel si l'enregistrement n'existe pas. */
export function orFail(record, model, id) {
  if (!record) {
    abort(404, { message: `No query results for model [App\\Models\\${model}] ${id ?? ''}`.trim() });
  }
  return record;
}

/**
 * Convertit une valeur avant envoi JSON pour reproduire la sortie Laravel :
 * Decimal → "12.00" (chaîne à 2 décimales), Date → ISO 8601 UTC.
 */
export function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed(2);
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) out[key] = serialize(val);
    }
    return out;
  }
  return value;
}

// ── Lecture des entrées (équivalents de $request->input / has / filled / boolean) ──

const KEEP_RAW = new Set(['password', 'password_confirmation', 'current_password', 'new_password', 'new_password_confirmation']);

/** TrimStrings + ConvertEmptyStringsToNull, comme les middlewares globaux Laravel. */
export function normalizeInput(value, key) {
  if (typeof value === 'string') {
    if (key && KEEP_RAW.has(key)) return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (Array.isArray(value)) return value.map((v) => normalizeInput(v));
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeInput(v, k);
    return out;
  }
  return value;
}

/** Query string + corps JSON fusionnés (le corps l'emporte), comme $request->all(). */
export function input(req) {
  const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
  return { ...normalizeInput({ ...req.query }), ...body };
}

export const has = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

export function filled(obj, key) {
  if (!has(obj, key)) return false;
  const v = obj[key];
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

export function bool(v) {
  if (typeof v === 'string') return ['1', 'true', 'on', 'yes'].includes(v.toLowerCase());
  return v === true || v === 1;
}

/** Garde uniquement les clés présentes parmi `keys` (équivalent de $request->only / $fillable). */
export function pick(obj, keys) {
  const out = {};
  for (const key of keys) if (has(obj, key)) out[key] = obj[key];
  return out;
}

export const num = (v) => (v === null || v === undefined ? v : Number(v));
export const int = (v) => (v === null || v === undefined ? v : Math.trunc(Number(v)));

/** number_format($n, 2) de PHP : séparateur de milliers ",", décimal ".". */
export function numberFormat(n) {
  const [whole, dec] = Math.abs(Number(n) || 0).toFixed(2).split('.');
  const sign = Number(n) < 0 && Number(whole + '.' + dec) !== 0 ? '-' : '';
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/** Arrondi à 2 décimales (évite 0.1 + 0.2 = 0.30000000000000004 dans les totaux). */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
