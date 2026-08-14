import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

/**
 * Determines whether the current user has stewardship-workspace access to a
 * habitat: they must be an active member of a steward group that actively
 * manages the habitat. Returns the group to use for creating workspace records
 * (prefers the primary group).
 */
export function useHabitatWorkspace(habitatId: string | undefined) {
  const [hasAccess, setHasAccess] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!habitatId) {
        setHasAccess(false);
        setGroupId(null);
        setLoading(false);
        return;
      }

      let active = true;

      const check = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setHasAccess(false);
            setGroupId(null);
            setLoading(false);
          }
          return;
        }

        const { data: accessRows } = await supabase
          .from('habitat_group_access')
          .select('group_id, is_primary')
          .eq('habitat_id', habitatId)
          .eq('status', 'active');

        if (!active) return;

        const managingGroupIds = (accessRows ?? []).map((r: any) => r.group_id);
        if (managingGroupIds.length === 0) {
          setHasAccess(false);
          setGroupId(null);
          setLoading(false);
          return;
        }

        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('group_id', managingGroupIds);

        if (!active) return;

        const memberGroupIds = new Set((memberships ?? []).map((m: any) => m.group_id));
        const primary = (accessRows ?? []).find(
          (r: any) => r.is_primary && memberGroupIds.has(r.group_id),
        );
        const fallback = (accessRows ?? []).find((r: any) => memberGroupIds.has(r.group_id));
        const picked = primary ?? fallback;

        if (picked) {
          setHasAccess(true);
          setGroupId(picked.group_id);
        } else {
          setHasAccess(false);
          setGroupId(null);
        }
        setLoading(false);
      };

      check();

      return () => {
        active = false;
      };
    }, [habitatId])
  );

  return { hasAccess, groupId, loading };
}
