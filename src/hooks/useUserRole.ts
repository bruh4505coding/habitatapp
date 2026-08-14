import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { normalizeUserRole, UserRole } from '../lib/roles';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const fetchRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setRole(null);
            setLoading(false);
          }
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (active) {
          setRole(normalizeUserRole(data?.role));
          setLoading(false);
        }
      };

      setLoading(true);
      fetchRole();

      return () => {
        active = false;
      };
    }, [])
  );

  return { role, loading };
}
