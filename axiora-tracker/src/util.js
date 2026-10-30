export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields);
export const forbidden = (message = 'You do not have permission to do this.') => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function str(value, { max = 10000 } = {}) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

export function optStr(value, opts) {
  const s = str(value, opts);
  return s === '' ? null : s;
}

export function intOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function truthy(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

/** Throws a 400 listing every missing field, so forms can highlight them together. */
export function requireFields(input, labels) {
  const fields = {};
  for (const [key, label] of Object.entries(labels)) {
    if (!str(input[key])) fields[key] = `${label} is required.`;
  }
  if (Object.keys(fields).length) throw badRequest('Please fill in the required fields.', fields);
}
