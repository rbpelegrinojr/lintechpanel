import { ForbiddenError } from './security.js';

export const ROLES = Object.freeze({ SUPER_ADMIN: 'super_admin', RESELLER: 'reseller', CUSTOMER: 'customer' });

export function requireRole(actor, ...allowed) {
  if (!actor || !allowed.includes(actor.role)) throw new ForbiddenError();
}

export function canManageUser(actor, subject) {
  if (!actor || !subject) return false;
  if (actor.role === ROLES.SUPER_ADMIN) return subject.role !== ROLES.SUPER_ADMIN || actor.id === subject.id;
  return actor.role === ROLES.RESELLER && subject.role === ROLES.CUSTOMER && subject.resellerId === actor.id;
}

export function requireOwner(actor, resource) {
  if (actor.role === ROLES.SUPER_ADMIN) return;
  if (resource.ownerId === actor.id) return;
  if (actor.role === ROLES.RESELLER && resource.resellerId === actor.id) return;
  throw new ForbiddenError();
}

