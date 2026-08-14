import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { GROUP_ROLE_LABELS } from '../../lib/groupRoles';
import { fetchGroupTeamMembers, TeamMember } from '../../lib/groupMembers';
import { OPEN_TASK_STATUSES } from '../../lib/tasks';

type Route = RouteProp<RootStackParamList, 'StewardDashboard'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type GroupData = {
  id: string;
  name: string;
  region: string | null;
};

export default function StewardDashboardScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [fieldUpdateCount, setFieldUpdateCount] = useState(0);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const { isMember, loading: membershipLoading } = useGroupMembership(groupId);

  useFocusEffect(useCallback(() => {
    const fetchDashboard = async () => {
      if (membershipLoading) return;

      setLoading(true);
      setAccessDenied(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMember) {
        setGroup(null);
        setMembers([]);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from('steward_groups')
        .select('id, name, region')
        .eq('id', groupId)
        .eq('status', 'active')
        .single();

      if (groupError || !groupData) {
        setGroup(null);
        setMembers([]);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setGroup(groupData);

      const [taskCountRes, updateCountRes, roster] = await Promise.all([
        supabase
          .from('steward_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('steward_group_id', groupId)
          .in('status', OPEN_TASK_STATUSES),
        supabase
          .from('field_updates')
          .select('id', { count: 'exact', head: true })
          .eq('steward_group_id', groupId),
        fetchGroupTeamMembers(groupId),
      ]);

      setOpenTaskCount(taskCountRes.error ? 0 : (taskCountRes.count ?? 0));
      setFieldUpdateCount(updateCountRes.error ? 0 : (updateCountRes.count ?? 0));
      setMembers(roster);
      setLoading(false);
    };

    fetchDashboard();
  }, [groupId, isMember, membershipLoading]));

  if (loading || membershipLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (accessDenied || !group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedTitle}>Members only</Text>
        <Text style={styles.deniedSub}>
          You must be an active member of this steward group to access the dashboard.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Text style={styles.badge}>Private workspace</Text>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.region ? <Text style={styles.region}>{group.region}</Text> : null}
        <Text style={styles.subtitle}>Steward Dashboard</Text>
      </View>

      <Text style={styles.sectionTitle}>Field Updates</Text>
      <TouchableOpacity
        style={styles.tasksCard}
        onPress={() => navigation.navigate('FieldUpdateList', { groupId })}
      >
        <View>
          <Text style={styles.tasksTitle}>
            {fieldUpdateCount === 0 ? 'No field updates' : `${fieldUpdateCount} field update${fieldUpdateCount === 1 ? '' : 's'}`}
          </Text>
          <Text style={styles.tasksSub}>Post and review observations from the field</Text>
        </View>
        <Text style={styles.tasksArrow}>→</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Open Tasks</Text>
      <TouchableOpacity
        style={styles.tasksCard}
        onPress={() => navigation.navigate('TaskList', { groupId })}
      >
        <View>
          <Text style={styles.tasksTitle}>
            {openTaskCount === 0 ? 'No open tasks' : `${openTaskCount} open task${openTaskCount === 1 ? '' : 's'}`}
          </Text>
          <Text style={styles.tasksSub}>View, create, and update stewardship tasks</Text>
        </View>
        <Text style={styles.tasksArrow}>→</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Team Members ({members.length})</Text>
      {members.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>No active members listed yet.</Text>
        </View>
      ) : (
        members.map((member) => (
          <TouchableOpacity
            key={member.userId}
            style={styles.memberCard}
            onPress={() => navigation.navigate('Profile', { userId: member.userId })}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {member.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.username}</Text>
              <Text style={styles.memberRole}>{GROUP_ROLE_LABELS[member.role]}</Text>
            </View>
            <Text style={styles.tasksArrow}>→</Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity
        style={styles.publicLink}
        onPress={() => navigation.navigate('StewardGroup', { groupId })}
      >
        <Text style={styles.publicLinkText}>View public group page →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f0f4f0',
  },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  headerCard: {
    backgroundColor: '#1a2e1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a5d6a7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  groupName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  region: { fontSize: 13, color: '#a5d6a7', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#c8e6c9', marginTop: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4caf50',
    marginBottom: 4,
  },
  placeholderText: { fontSize: 14, color: '#888', lineHeight: 20 },
  tasksCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tasksTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e1a' },
  tasksSub: { fontSize: 13, color: '#888', marginTop: 4 },
  tasksArrow: { fontSize: 20, color: '#4caf50', fontWeight: '700' },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: '#1a2e1a' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1a2e1a' },
  memberRole: { fontSize: 12, color: '#666', marginTop: 2 },
  publicLink: { marginTop: 8, alignItems: 'center' },
  publicLinkText: { fontSize: 14, color: '#4caf50', fontWeight: '600' },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
