import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { GroupMemberRole, isGroupMemberRole } from '../lib/groupRoles';

export type { GroupMemberRole };

export function useGroupMembership(groupId: string | undefined) {
  const [isMember, setIsMember] = useState(false);
  const [memberRole, setMemberRole] = useState<GroupMemberRole | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!groupId) {
        setIsMember(false);
        setMemberRole(null);
        setLoading(false);
        return;
      }

      let active = true;

      const checkMembership = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setIsMember(false);
            setMemberRole(null);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!active) return;

        if (!error && data) {
          const role = data.role === 'admin' ? 'manager' : data.role;
          setIsMember(true);
          setMemberRole(isGroupMemberRole(role) ? role : 'member');
          setLoading(false);
          return;
        }

        const { data: group } = await supabase
          .from('steward_groups')
          .select('created_by')
          .eq('id', groupId)
          .maybeSingle();

        if (!active) return;

        if (group?.created_by === user.id) {
          setIsMember(true);
          setMemberRole('manager');
        } else {
          setIsMember(false);
          setMemberRole(null);
        }
        setLoading(false);
      };

      checkMembership();

      return () => {
        active = false;
      };
    }, [groupId])
  );

  return { isMember, memberRole, loading };
}
