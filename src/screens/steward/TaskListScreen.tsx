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
import {
  StewardTaskRow,
  OPEN_TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  formatDueDate,
  TaskStatus,
} from '../../lib/tasks';

type Route = RouteProp<RootStackParamList, 'TaskList'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Filter = 'open' | 'completed' | 'archived' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

function TaskListContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [tasks, setTasks] = useState<StewardTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('open');

  const fetchTasks = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('steward_tasks')
      .select(`
        id, steward_group_id, habitat_id, title, description,
        priority, status, assigned_to, due_date, created_by,
        created_at, updated_at,
        habitats ( name, habitat_code ),
        assignee:profiles!assigned_to ( username ),
        creator:profiles!created_by ( username )
      `)
      .eq('steward_group_id', groupId)
      .order('updated_at', { ascending: false });

    if (filter === 'open') {
      query = query.in('status', OPEN_TASK_STATUSES);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'archived') {
      query = query.eq('status', 'archived');
    }

    const { data, error } = await query;

    if (error) {
      setTasks([]);
    } else {
      setTasks((data ?? []) as StewardTaskRow[]);
    }
    setLoading(false);
  }, [groupId, filter]);

  useFocusEffect(useCallback(() => {
    fetchTasks();
  }, [fetchTasks]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <Text style={styles.title}>Tasks</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateTask', { groupId })}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

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
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySub}>
              Create a task to track stewardship work for your group.
            </Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => navigation.navigate('TaskDetail', { groupId, taskId: task.id })}
            >
              <View style={styles.taskTopRow}>
                <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                <View style={[styles.badge, { backgroundColor: TASK_STATUS_COLORS[task.status as TaskStatus] }]}>
                  <Text style={styles.badgeText}>{TASK_STATUS_LABELS[task.status as TaskStatus]}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.priority, { color: TASK_PRIORITY_COLORS[task.priority] }]}>
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Text>
                {task.habitats ? (
                  <Text style={styles.metaText}>
                    · {task.habitats.habitat_code ?? task.habitats.name}
                  </Text>
                ) : null}
                {task.due_date ? (
                  <Text style={styles.metaText}> · Due {formatDueDate(task.due_date)}</Text>
                ) : null}
              </View>
              {task.assignee?.username ? (
                <Text style={styles.assignee}>Assigned to {task.assignee.username}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default function TaskListScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <TaskListContent />
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
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a' },
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
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  taskTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a2e1a' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, alignItems: 'center' },
  priority: { fontSize: 12, fontWeight: '700' },
  metaText: { fontSize: 12, color: '#888' },
  assignee: { fontSize: 12, color: '#666', marginTop: 6 },
});
