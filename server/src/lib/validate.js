// Mini-validateur reprenant les règles Laravel utilisées par l'ancienne API,
// avec les mêmes messages (lang/fr/validation.php) et le même format de réponse 422 :
//   { message: "...", errors: { champ: ["..."] } }
import { prisma } from './prisma.js';
import { HttpError, has } from './http.js';
import { isValidDate, parseDate } from './dates.js';

const ATTRIBUTES = {
  name: 'nom',
  email: 'email',
  password: 'mot de passe',
  role: 'rôle',
  salon_name: 'nom du salon',
  plan_id: 'plan',
  phone: 'téléphone',
  category: 'catégorie',
  price: 'prix',
  quantity: 'quantité',
  duration: 'durée',
  reason: 'motif',
  notes: 'notes',
  date: 'date',
  starts_at: 'date de début',
  ends_at: 'date de fin',
};

const MESSAGES = {
  required: 'Le champ :attribute est obligatoire.',
  required_with: 'Le champ :attribute est obligatoire quand :values est présent.',
  required_without: 'Le champ :attribute est obligatoire quand :values est absent.',
  string: 'Le champ :attribute doit être une chaîne de caractères.',
  email: 'Le champ :attribute doit être une adresse email valide.',
  numeric: 'Le champ :attribute doit être un nombre.',
  integer: 'Le champ :attribute doit être un nombre entier.',
  boolean: 'Le champ :attribute doit être vrai ou faux.',
  array: 'Le champ :attribute doit être un tableau.',
  date: 'Le champ :attribute doit être une date valide.',
  in: 'La valeur sélectionnée pour :attribute est invalide.',
  exists: 'La valeur sélectionnée pour :attribute est invalide.',
  unique: 'Cette valeur pour :attribute est déjà utilisée.',
  same: 'Les champs :attribute et :other doivent correspondre.',
  confirmed: 'La confirmation du champ :attribute ne correspond pas.',
  after_or_equal: 'Le champ :attribute doit être une date postérieure ou égale à :date.',
  min: {
    numeric: 'Le champ :attribute doit être au moins :min.',
    string: 'Le champ :attribute doit contenir au moins :min caractères.',
    array: 'Le champ :attribute doit contenir au moins :min éléments.',
  },
  max: {
    numeric: 'Le champ :attribute ne doit pas être supérieur à :max.',
    string: 'Le champ :attribute ne doit pas dépasser :max caractères.',
    array: 'Le champ :attribute ne doit pas contenir plus de :max éléments.',
  },
};

const attributeName = (key) => ATTRIBUTES[key] ?? key.replace(/_/g, ' ');

function message(template, key, replacements = {}) {
  let text = template.replace(':attribute', attributeName(key));
  for (const [k, v] of Object.entries(replacements)) text = text.replace(`:${k}`, v);
  return text;
}

function parseRules(ruleString) {
  return ruleString.split('|').map((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return { name: part, params: [] };
    return { name: part.slice(0, idx), params: part.slice(idx + 1).split(',') };
  });
}

function getPath(data, path) {
  return path.split('.').reduce((acc, seg) => (acc == null ? undefined : acc[seg]), data);
}

function isPresent(data, path) {
  const segments = path.split('.');
  const last = segments.pop();
  const parent = segments.length ? getPath(data, segments.join('.')) : data;
  return parent != null && typeof parent === 'object' && has(parent, last);
}

/** "services.*.service_id" → ["services.0.service_id", "services.1.service_id", ...] */
function expand(pattern, data) {
  const star = pattern.indexOf('*');
  if (star === -1) return [pattern];
  const head = pattern.slice(0, star - 1);
  const tail = pattern.slice(star + 1);
  const arr = getPath(data, head);
  if (!arr || typeof arr !== 'object') return [];
  return Object.keys(arr).flatMap((k) => expand(`${head}.${k}${tail}`, data));
}

const isEmptyValue = (v) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

const isNumeric = (v) =>
  (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));

const isIntegerLike = (v) =>
  (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && /^[+-]?\d+$/.test(v.trim()));

const isArrayLike = (v) => Array.isArray(v) || (v !== null && typeof v === 'object');

const IDENT = /^[a-z_]+$/;

async function existsInTable(table, column, value) {
  if (!IDENT.test(table) || !IDENT.test(column)) throw new Error(`Identifiant invalide: ${table}.${column}`);
  let param = value;
  if (column === 'id' || column.endsWith('_id')) {
    if (!isIntegerLike(value)) return false;
    param = Number(value);
  } else {
    param = String(value);
  }
  const rows = await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE "${column}" = $1 LIMIT 1`, param);
  return rows.length > 0;
}

async function uniqueInTable(table, column, value, ignoreId) {
  if (!IDENT.test(table) || !IDENT.test(column)) throw new Error(`Identifiant invalide: ${table}.${column}`);
  // Comparaison insensible à la casse, comme la collation utf8mb4_unicode_ci de MySQL
  let sql = `SELECT 1 FROM "${table}" WHERE lower("${column}") = lower($1)`;
  const params = [String(value)];
  if (ignoreId != null && ignoreId !== '' && isIntegerLike(String(ignoreId))) {
    sql += ' AND "id" <> $2';
    params.push(Number(ignoreId));
  }
  const rows = await prisma.$queryRawUnsafe(`${sql} LIMIT 1`, ...params);
  return rows.length === 0;
}

async function checkField(key, rules, data) {
  const names = rules.map((r) => r.name);
  const present = isPresent(data, key);
  const value = getPath(data, key);

  if (names.includes('sometimes') && !present) return null;

  const empty = isEmptyValue(value);
  for (const rule of rules) {
    if (rule.name === 'required' && empty) return message(MESSAGES.required, key);
    if (rule.name === 'required_with' && empty && rule.params.some((p) => !isEmptyValue(getPath(data, p)))) {
      return message(MESSAGES.required_with, key, { values: rule.params.join(' / ') });
    }
    if (rule.name === 'required_without' && empty && rule.params.some((p) => isEmptyValue(getPath(data, p)))) {
      return message(MESSAGES.required_without, key, { values: rule.params.join(' / ') });
    }
  }

  // Les autres règles ne s'appliquent qu'aux champs présents (et non null si "nullable")
  if (!present) return null;
  if (value === null && names.includes('nullable')) return null;

  const sizeType = names.includes('numeric') || names.includes('integer')
    ? 'numeric'
    : names.includes('array') ? 'array' : 'string';
  const sizeOf = (v) => {
    if (sizeType === 'numeric') return Number(v);
    if (sizeType === 'array') return Array.isArray(v) ? v.length : Object.keys(v ?? {}).length;
    return [...String(v ?? '')].length;
  };

  for (const { name, params } of rules) {
    switch (name) {
      case 'string':
        if (typeof value !== 'string') return message(MESSAGES.string, key);
        break;
      case 'email':
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return message(MESSAGES.email, key);
        break;
      case 'numeric':
        if (!isNumeric(value)) return message(MESSAGES.numeric, key);
        break;
      case 'integer':
        if (!isIntegerLike(value)) return message(MESSAGES.integer, key);
        break;
      case 'boolean':
        if (![true, false, 0, 1, '0', '1'].includes(value)) return message(MESSAGES.boolean, key);
        break;
      case 'array':
        if (!isArrayLike(value)) return message(MESSAGES.array, key);
        break;
      case 'date':
        if (!(typeof value === 'string' || typeof value === 'number') || !isValidDate(value)) return message(MESSAGES.date, key);
        break;
      case 'in':
        if (!params.includes(String(value))) return message(MESSAGES.in, key);
        break;
      case 'min':
        if (sizeOf(value) < Number(params[0])) return message(MESSAGES.min[sizeType], key, { min: params[0] });
        break;
      case 'max':
        if (sizeOf(value) > Number(params[0])) return message(MESSAGES.max[sizeType], key, { max: params[0] });
        break;
      case 'same':
        if (String(value) !== String(getPath(data, params[0]))) {
          return message(MESSAGES.same, key, { other: attributeName(params[0]) });
        }
        break;
      case 'confirmed':
        if (String(value) !== String(getPath(data, `${key}_confirmation`))) return message(MESSAGES.confirmed, key);
        break;
      case 'after_or_equal': {
        const other = getPath(data, params[0]) ?? params[0];
        if (isValidDate(other) && parseDate(value) < parseDate(other)) {
          return message(MESSAGES.after_or_equal, key, { date: attributeName(params[0]) });
        }
        break;
      }
      case 'exists': {
        const column = params[1] ?? key.split('.').pop();
        if (!(await existsInTable(params[0], column, value))) return message(MESSAGES.exists, key);
        break;
      }
      case 'unique': {
        const column = params[1] ?? key.split('.').pop();
        if (!(await uniqueInTable(params[0], column, value, params[2]))) return message(MESSAGES.unique, key);
        break;
      }
      default:
        break;
    }
  }
  return null;
}

/**
 * Valide `data` selon des règles au format Laravel ("required|string|max:255").
 * Lève une erreur 422 si invalide, sinon renvoie les champs de premier niveau validés et présents.
 */
export async function validate(data, rules) {
  const errors = {};
  for (const [pattern, ruleString] of Object.entries(rules)) {
    const parsed = parseRules(ruleString);
    for (const key of expand(pattern, data)) {
      const error = await checkField(key, parsed, data);
      if (error) errors[key] = [error];
    }
  }

  const messages = Object.values(errors).flat();
  if (messages.length) {
    const extra = messages.length - 1;
    const message = extra > 0 ? `${messages[0]} (and ${extra} more error${extra > 1 ? 's' : ''})` : messages[0];
    throw new HttpError(422, { message, errors });
  }

  const validated = {};
  for (const pattern of Object.keys(rules)) {
    const top = pattern.split('.')[0];
    if (has(data, top)) validated[top] = data[top];
  }
  return validated;
}

/**
 * Variante utilisée par les contrôleurs qui faisaient Validator::make() à la main :
 * renvoie { success: false, message: 'Erreur de validation', errors } en 422.
 */
export async function validateOrFail(data, rules) {
  try {
    return await validate(data, rules);
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      throw new HttpError(422, { success: false, message: 'Erreur de validation', errors: err.body.errors });
    }
    throw err;
  }
}
