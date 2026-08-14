export type UserRole = 'user' | 'admin';

export const ROLES: UserRole[] = ['user', 'admin'];

export function isUserRole(value: string | null | undefined): value is UserRole {
  if (value === 'user' || value === 'admin') return true;
  // Legacy roles from before simplification — treat as regular user
  if (value === 'observer' || value === 'contributor' || value === 'verifier') return true;
  return false;
}

/** Normalize legacy platform roles to the current model */
export function normalizeUserRole(value: string | null | undefined): UserRole {
  if (value === 'admin') return 'admin';
  return 'user';
}

/** Platform admin — manage users and system-wide settings */
export function canManageUsers(role: UserRole | null): boolean {
  return role === 'admin';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  admin: 'System Admin',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  user: '#4caf50',
  admin: '#e53935',
};

export function roleLabel(value: string | null | undefined): string {
  return ROLE_LABELS[normalizeUserRole(value)];
}

export function roleColor(value: string | null | undefined): string {
  return ROLE_COLORS[normalizeUserRole(value)];
}
