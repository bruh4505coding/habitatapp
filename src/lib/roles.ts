export type UserRole = 'observer' | 'contributor' | 'verifier' | 'admin';

export const ROLES: UserRole[] = ['observer', 'contributor', 'verifier', 'admin'];

const ROLE_RANK: Record<UserRole, number> = {
  observer: 0,
  contributor: 1,
  verifier: 2,
  admin: 3,
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return ROLES.includes(value as UserRole);
}

export function hasMinRole(userRole: UserRole | null, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

/** Observer+ — view habitats and profiles */
export function canViewHabitats(role: UserRole | null): boolean {
  return hasMinRole(role, 'observer');
}

/** Observer+ — add informal observations */
export function canAddObservation(role: UserRole | null): boolean {
  return hasMinRole(role, 'observer');
}

/** Contributor+ — submit formal contributions */
export function canSubmitContribution(role: UserRole | null): boolean {
  return hasMinRole(role, 'contributor');
}

/** Contributor+ — suggest boundary edits */
export function canSubmitBoundaryEdit(role: UserRole | null): boolean {
  return hasMinRole(role, 'contributor');
}

/** Verifier+ — approve/reject submissions */
export function canReviewSubmissions(role: UserRole | null): boolean {
  return hasMinRole(role, 'verifier');
}

/** Admin only — manage users and roles */
export function canManageUsers(role: UserRole | null): boolean {
  return role === 'admin';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  observer: 'Observer',
  contributor: 'Contributor',
  verifier: 'Verifier',
  admin: 'Admin',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  observer: '#4caf50',
  contributor: '#2196f3',
  verifier: '#ff9800',
  admin: '#e53935',
};
