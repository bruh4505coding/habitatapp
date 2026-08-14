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
import FieldUpdateCard from '../../components/steward/FieldUpdateCard';
import { FieldUpdateRow } from '../../lib/fieldUpdates';

type Route = RouteProp<RootStackParamList, 'StewardGroup'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type GroupData = {
  id: string;
  name: string;
  mission: string | null;
  description: string | null;
  region: string | null;
};

type LinkedHabitat = {
  id: string;
  name: string;
  habitat_code: string | null;
  habitat_type: string | null;
  region: string | null;
};

export default function StewardGroupScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [habitats, setHabitats] = useState<LinkedHabitat[]>([]);
  const [publicUpdates, setPublicUpdates] = useState<FieldUpdateRow[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { isMember, memberRole, loading: membershipLoading } = useGroupMembership(groupId);

  useFocusEffect(useCallback(() => {
    const fetchGroup = async () => {
      setLoading(true);
      setNotFound(false);

      const { data: groupData, error: groupError } = await supabase
        .from('steward_groups')
        .select('id, name, mission, description, region')
        .eq('id', groupId)
        .eq('is_public', true)
        .eq('status', 'active')
        .single();

      if (groupError || !groupData) {
        setGroup(null);
        setHabitats([]);
        setMembers([]);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setGroup(groupData);

      const [accessRes, updatesRes, roster] = await Promise.all([
        supabase
          .from('habitat_group_access')
          .select(`
            is_primary,
            habitats (
              id, name, habitat_code, habitat_type, region
            )
          `)
          .eq('group_id', groupId)
          .eq('status', 'active'),
        supabase
          .from('field_updates')
          .select(`
            id, steward_group_id, habitat_id, user_id, title, body,
            category, photo_url, visibility, created_at,
            habitats ( name, habitat_code ),
            author:profiles!user_id ( username )
          `)
          .eq('steward_group_id', groupId)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(10),
        fetchGroupTeamMembers(groupId),
      ]);

      const linked = (accessRes.data ?? [])
        .map((row: any) => row.habitats)
        .filter(Boolean)
        .sort((a: LinkedHabitat, b: LinkedHabitat) =>
          a.name.localeCompare(b.name)
        ) as LinkedHabitat[];

      setHabitats(linked);
      setPublicUpdates((updatesRes.data ?? []) as FieldUpdateRow[]);
      setMembers(roster);
      setLoading(false);
    };

    fetchGroup();
  }, [groupId]));

  if (loading || membershipLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (notFound || !group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Steward Group not found</Text>
        <Text style={styles.notFoundSub}>This group may be private or no longer active.</Text>
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
        <Text style={styles.groupName}>{group.name}</Text>
        {group.region ? <Text style={styles.region}>{group.region}</Text> : null}
        {group.mission ? (
          <Text style={styles.mission}>{group.mission}</Text>
        ) : group.description ? (
          <Text style={styles.mission}>{group.description}</Text>
        ) : (
          <Text style={styles.missionMuted}>No mission statement yet.</Text>
        )}
        {isMember ? (
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => navigation.navigate('StewardDashboard', { groupId })}
          >
            <Text style={styles.dashboardButtonText}>
              Open Steward Dashboard{memberRole ? ` · ${GROUP_ROLE_LABELS[memberRole]}` : ''}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Active Habitats</Text>
      {habitats.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>No habitats linked to this group yet.</Text>
        </View>
      ) : (
        habitats.map((h) => (
          <TouchableOpacity
            key={h.id}
            style={styles.habitatCard}
            onPress={() => navigation.navigate('HabitatDetail', { habitatId: h.id })}
          >
            <Text style={styles.habitatName}>{h.habitat_code ?? h.name}</Text>
            <Text style={styles.habitatMeta}>
              {[h.habitat_type, h.region].filter(Boolean).join(' · ') || h.name}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.sectionTitle}>Field Updates</Text>
      {publicUpdates.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>No public field updates yet.</Text>
        </View>
      ) : (
        publicUpdates.map((update) => (
          <FieldUpdateCard key={update.id} update={update} showVisibility={false} compact />
        ))
      )}

      <Text style={styles.sectionTitle}>Team ({members.length})</Text>
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
            <Text style={styles.memberArrow}>→</Text>
          </TouchableOpacity>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f5f5f0',
  },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#eee',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  groupName: { fontSize: 26, fontWeight: '800', color: '#1a2e1a' },
  region: { fontSize: 13, color: '#888', marginTop: 4 },
  mission: { fontSize: 15, color: '#444', lineHeight: 22, marginTop: 12 },
  missionMuted: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginTop: 12 },
  dashboardButton: {
    marginTop: 16,
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dashboardButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  habitatCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  habitatName: { fontSize: 16, fontWeight: '700', color: '#1a2e1a' },
  habitatMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
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
  memberArrow: { fontSize: 16, color: '#4caf50', fontWeight: '700' },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  placeholderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4caf50',
    marginBottom: 4,
  },
  placeholderText: { fontSize: 14, color: '#888', lineHeight: 20 },
  notFoundTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  notFoundSub: { fontSize: 14, color: '#888', textAlign: 'center' },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
