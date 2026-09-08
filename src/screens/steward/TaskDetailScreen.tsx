import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GroupMembersOnlyGate from '../../components/steward/GroupMembersOnlyGate';
import {
  StewardTaskRow,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  formatDueDate,
  TaskStatus,
} from '../../lib/tasks';

type Route = RouteProp<RootStackParamList, 'TaskDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function TaskDetailContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId, taskId } = route.params;

  const [task, setTask] = useState<StewardTaskRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('steward_tasks')
      .select(`
        id, steward_group_id, habitat_id, title, description,
        priority, status, assigned_to, due_date, created_by,
        created_at, updated_at,
        habitats ( name, habitat_code ),
        assignee:profiles!assigned_to ( username ),
        creator:profiles!created_by ( username )
      `)
      .eq('id', taskId)
      .eq('steward_group_id', groupId)
      .single();

    if (error || !data) {
      setTask(null);
    } else {
      setTask(data as StewardTaskRow);
    }
    setLoading(false);
  }, [groupId, taskId]);

  useFocusEffect(useCallback(() => {
    fetchTask();
  }, [fetchTask]));

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task || task.status === newStatus) return;

    setUpdatingStatus(true);

    const { error } = await supabase
      .from('steward_tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
      .eq('steward_group_id', groupId);

    setUpdatingStatus(false);

    if (error) {
      Alert.alert('Update failed', error.message);
    } else {
      setTask({ ...task, status: newStatus });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Task not found.</Text>
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

      <Text style={styles.title}>{task.title}</Text>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: TASK_STATUS_COLORS[task.status] }]}>
          <Text style={styles.badgeText}>{TASK_STATUS_LABELS[task.status]}</Text>
        </View>
        <Text style={[styles.priority, { color: TASK_PRIORITY_COLORS[task.priority] }]}>
          {TASK_PRIORITY_LABELS[task.priority]} priority
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.bodyText}>
          {task.description?.trim() || 'No description provided.'}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Habitat</Text>
          <Text style={styles.infoValue}>
            {task.habitats
              ? (task.habitats.habitat_code ?? task.habitats.name)
              : '—'}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Assigned to</Text>
          <Text style={styles.infoValue}>{task.assignee?.username ?? 'Unassigned'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Due date</Text>
          <Text style={styles.infoValue}>{formatDueDate(task.due_date)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Created by</Text>
          <Text style={styles.infoValue}>{task.creator?.username ?? '—'}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Update status</Text>
      {updatingStatus ? (
        <ActivityIndicator color="#4caf50" style={styles.statusLoader} />
      ) : (
        <View style={styles.statusRow}>
          {TASK_STATUSES.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusChip,
                task.status === status && styles.statusChipActive,
                task.status === status && { borderColor: TASK_STATUS_COLORS[status] },
              ]}
              onPress={() => handleStatusChange(status)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  task.status === status && { color: TASK_STATUS_COLORS[status] },
                ]}
              >
                {TASK_STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {task.habitat_id ? (
        <TouchableOpacity
          style={styles.habitatLink}
          onPress={() => navigation.navigate('HabitatDetail', { habitatId: task.habitat_id! })}
        >
          <Text style={styles.habitatLinkText}>View linked habitat →</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

export default function TaskDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <TaskDetailContent />
    </GroupMembersOnlyGate>
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
  title: { fontSize: 24, fontWeight: '800', color: '#1a2e1a', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  priority: { fontSize: 13, fontWeight: '700' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  bodyText: { fontSize: 15, color: '#444', lineHeight: 22 },
  infoGrid: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a2e1a' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusChipActive: { backgroundColor: '#f5f5f0' },
  statusChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  statusLoader: { marginVertical: 12 },
  habitatLink: { marginTop: 24, alignItems: 'center' },
  habitatLinkText: { fontSize: 14, color: '#4caf50', fontWeight: '600' },
  notFound: { fontSize: 18, fontWeight: '700', color: '#1a2e1a', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
