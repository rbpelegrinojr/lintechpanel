import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanText(value, name, max = 255) {
  if (typeof value !== 'string') throw new InputError(`${name} must be a string`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new InputError(`${name} is invalid`);
  }
  return result;
}

export function cleanEmail(value) {
  const email = cleanText(value, 'email', 254).toLowerCase();
  if (!EMAIL.test(email)) throw new InputError('email is invalid');
  return email;
}

export function cleanUsername(value) {
  const username = cleanText(value, 'username', 32).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) throw new InputError('username is invalid');
  return username;
}

export function cleanDomain(value) {
  const domain = cleanText(value, 'domain', 253).toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new InputError('domain is invalid');
  }
  return domain;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 1024) {
    throw new InputError('password must contain 14 to 1024 characters');
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new InputError('password must include upper-case, lower-case, and numeric characters');
  }
  return password;
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [kind, n, r, p, saltText, hashText] = encoded.split('$');
    if (kind !== 'scrypt') return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
    }));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

export function token(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
export function tokenHash(value) { return createHash('sha256').update(value).digest('hex'); }
export function publicUser(user) {
  const { passwordHash, systemUsername, ...safe } = user;
  return safe;
}

export class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
export class AuthError extends Error { constructor(message = 'authentication required') { super(message); this.status = 401; } }
export class ForbiddenError extends Error { constructor(message = 'forbidden') { super(message); this.status = 403; } }
export class NotFoundError extends Error { constructor(message = 'not found') { super(message); this.status = 404; } }
