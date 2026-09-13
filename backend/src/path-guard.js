import path from 'node:path';
import fs from 'node:fs/promises';
import { InputError, ForbiddenError } from './security.js';

export async function confinedPath(root, requested = '.', { mustExist = false } = {}) {
  if (typeof requested !== 'string' || requested.includes('\0') || path.isAbsolute(requested)) {
    throw new InputError('path is invalid');
  }
  const rootReal = await fs.realpath(root);
  const candidate = path.resolve(rootReal, requested);
  const relative = path.relative(rootReal, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ForbiddenError('path escapes account root');
  if (mustExist) {
    const real = await fs.realpath(candidate);
    const realRelative = path.relative(rootReal, real);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new ForbiddenError('symlink escapes account root');
    return real;
  }
  const parent = await fs.realpath(path.dirname(candidate));
  const parentRelative = path.relative(rootReal, parent);
  if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) throw new ForbiddenError('parent escapes account root');
  return candidate;
}

export function safeArchiveEntry(entry) {
  if (typeof entry !== 'string' || !entry || entry.includes('\0') || path.posix.isAbsolute(entry)) return false;
  const normalized = path.posix.normalize(entry.replaceAll('\\', '/'));
  return normalized !== '..' && !normalized.startsWith('../');
}

