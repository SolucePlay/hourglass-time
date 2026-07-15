import { Permission } from '../types/permission';

export type PermissionContainer = Set<Permission> | Permission[] | string[] | null | undefined;

export function hasPermission(container: PermissionContainer, permission: Permission): boolean {
  if (!container) return false;

  if (container instanceof Set) {
    return container.has(permission);
  }

  return container.includes(permission);
}

export function toPermissionSet(container: PermissionContainer): Set<Permission> {
  if (!container) return new Set<Permission>();
  if (container instanceof Set) return new Set(container);
  return new Set(container as Permission[]);
}
