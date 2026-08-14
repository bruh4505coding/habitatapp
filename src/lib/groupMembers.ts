import { supabase } from './supabase';
import { GroupMemberRole, isGroupMemberRole } from './groupRoles';

export type TeamMember = {
  userId: string;
  username: string;
  role: GroupMemberRole;
};

const ROLE_SORT: Record<GroupMemberRole, number> = {
  manager: 0,
  lead: 1,
  member: 2,
};

function normalizeRole(raw: string | null | undefined): GroupMemberRole {
  const role = raw === 'admin' ? 'manager' : raw;
  return isGroupMemberRole(role) ? role : 'member';
}

function sortRoster(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    const byRole = ROLE_SORT[a.role] - ROLE_SORT[b.role];
    if (byRole !== 0) return byRole;
    return a.username.localeCompare(b.username);
  });
}

async function usernamesFor(userIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', unique);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.id) map[row.id] = row.username ?? 'Unknown';
  }
  return map;
}

/**
 * Active group roster for Team UI.
 * Uses an explicit profiles FK (user_id) so PostgREST does not fail on
 * the second profiles reference (invited_by). Also includes created_by
 * when that user has no group_members row.
 */
export async function fetchGroupTeamMembers(groupId: string): Promise<TeamMember[]> {
  const [membersRes, groupRes] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, role, profile:profiles!user_id ( username )')
      .eq('group_id', groupId)
      .eq('status', 'active'),
    supabase
      .from('steward_groups')
      .select('created_by')
      .eq('id', groupId)
      .maybeSingle(),
  ]);

  let rows: Array<{ user_id: string; role: string; profile?: { username?: string } | null }> = [];

  if (!membersRes.error && membersRes.data) {
    rows = membersRes.data as typeof rows;
  } else {
    // Embed failed (common when user_id + invited_by both FK to profiles).
    const plain = await supabase
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', groupId)
      .eq('status', 'active');
    rows = (plain.data ?? []) as typeof rows;
  }

  const rosterMap = new Map<string, TeamMember>();

  for (const row of rows as any[]) {
    const userId = row.user_id as string;
    if (!userId) continue;
    const profile = row.profile;
    const embedded = Array.isArray(profile)
      ? profile[0]?.username
      : profile?.username;
    rosterMap.set(userId, {
      userId,
      username: (typeof embedded === 'string' && embedded.trim()) || 'Unknown',
      role: normalizeRole(row.role),
    });
  }

  const creatorId = groupRes.data?.created_by as string | null | undefined;
  if (creatorId && !rosterMap.has(creatorId)) {
    rosterMap.set(creatorId, {
      userId: creatorId,
      username: 'Unknown',
      role: 'manager',
    });
  }

  const names = await usernamesFor([...rosterMap.keys()]);
  for (const [userId, member] of rosterMap) {
    if (names[userId]) {
      rosterMap.set(userId, { ...member, username: names[userId] });
    }
  }

  return sortRoster([...rosterMap.values()]);
}
