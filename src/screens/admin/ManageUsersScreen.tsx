import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import {
  UserRole, ROLES, ROLE_LABELS, ROLE_COLORS, canManageUsers, normalizeUserRole,
} from '../../lib/roles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ManageUsers'>;

type ProfileRow = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

export default function ManageUsersScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!canManageUsers(normalizeUserRole(myProfile?.role))) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, role')
      .order('username');

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    setUsers(
      (data ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        email: p.email,
        role: normalizeUserRole(p.role),
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]));

  const changeRole = (profile: ProfileRow) => {
    Alert.alert(
      `Change role for ${profile.username}`,
      'Select a new role:',
      [
        ...ROLES.map((role) => ({
          text: ROLE_LABELS[role],
          onPress: () => applyRoleChange(profile.id, role),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const applyRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    setUpdatingId(null);

    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Admin Only</Text>
        <Text style={styles.deniedSubtitle}>Only system admins can manage user roles.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Users</Text>
        <Text style={styles.subtitle}>Tap a user to change their role</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {users.map((user) => (
          <TouchableOpacity
            key={user.id}
            style={styles.card}
            onPress={() => changeRole(user)}
            disabled={updatingId === user.id}
          >
            <View style={styles.cardMain}>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] }]}>
              {updatingId === user.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.roleBadgeText}>{ROLE_LABELS[user.role]}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a2e1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardMain: { flex: 1, marginRight: 12 },
  username: { fontSize: 16, fontWeight: '700', color: '#1a2e1a' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
  },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deniedIcon: { fontSize: 48, marginBottom: 16 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
