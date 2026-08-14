import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GroupMembersOnlyGate from '../../components/steward/GroupMembersOnlyGate';
import FieldUpdateCard from '../../components/steward/FieldUpdateCard';
import { FieldUpdateRow, FieldUpdateVisibility } from '../../lib/fieldUpdates';

type Route = RouteProp<RootStackParamList, 'FieldUpdateList'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Filter = 'all' | 'public' | 'private';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
];

function FieldUpdateListContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [updates, setUpdates] = useState<FieldUpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchUpdates = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('field_updates')
      .select(`
        id, steward_group_id, habitat_id, user_id, title, body,
        category, photo_url, visibility, created_at,
        habitats ( name, habitat_code ),
        author:profiles!user_id ( username )
      `)
      .eq('steward_group_id', groupId)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('visibility', filter as FieldUpdateVisibility);
    }

    const { data, error } = await query;

    if (error) {
      setUpdates([]);
    } else {
      setUpdates((data ?? []) as unknown as FieldUpdateRow[]);
    }
    setLoading(false);
  }, [groupId, filter]);

  useFocusEffect(useCallback(() => {
    fetchUpdates();
  }, [fetchUpdates]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <Text style={styles.title}>Field Updates</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateFieldUpdate', { groupId })}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Share field observations with your team. Public updates appear on the group page.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color="#4caf50" style={styles.loader} />
        ) : updates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No field updates yet</Text>
            <Text style={styles.emptySub}>
              Post updates from the field to keep your steward group informed.
            </Text>
          </View>
        ) : (
          updates.map((update) => (
            <FieldUpdateCard
              key={update.id}
              update={update}
              compact
              onPress={() => navigation.navigate('FieldUpdateDetail', { groupId, updateId: update.id })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default function FieldUpdateListScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <FieldUpdateListContent />
    </GroupMembersOnlyGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a' },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 16 },
  addButton: {
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow: { marginBottom: 16, maxHeight: 40 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#1a2e1a', borderColor: '#1a2e1a' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 40 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
