export type GroupMemberRole = 'member' | 'lead' | 'manager';

export const GROUP_MEMBER_ROLES: GroupMemberRole[] = ['member', 'lead', 'manager'];

export const GROUP_ROLE_LABELS: Record<GroupMemberRole, string> = {
  member: 'Member',
  lead: 'Lead',
  manager: 'Group Manager',
};

export function isGroupMemberRole(value: string | null | undefined): value is GroupMemberRole {
  return GROUP_MEMBER_ROLES.includes(value as GroupMemberRole);
}

/** Lead or group manager — can manage group content (overview, surveys, tasks, etc.) */
export function isGroupLeadOrManager(role: GroupMemberRole | null | undefined): boolean {
  return role === 'lead' || role === 'manager';
}

/** Group manager only — roster and group settings (future UI) */
export function isGroupManager(role: GroupMemberRole | null | undefined): boolean {
  return role === 'manager';
}
