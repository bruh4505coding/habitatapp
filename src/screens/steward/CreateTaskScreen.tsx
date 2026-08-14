import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GroupMembersOnlyGate from '../../components/steward/GroupMembersOnlyGate';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TaskPriority,
} from '../../lib/tasks';

type Route = RouteProp<RootStackParamList, 'CreateTask'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type HabitatOption = { id: string; label: string };
type MemberOption = { id: string; username: string };

function CreateTaskContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [habitatId, setHabitatId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [habitats, setHabitats] = useState<HabitatOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    const loadOptions = async () => {
      const [habitatRes, memberRes] = await Promise.all([
        supabase
          .from('habitat_group_access')
          .select('habitats ( id, name, habitat_code )')
          .eq('group_id', groupId)
          .eq('status', 'active'),
        supabase
          .from('group_members')
          .select('user_id, profile:profiles!user_id ( username )')
          .eq('group_id', groupId)
          .eq('status', 'active'),
      ]);

      const habitatOptions = (habitatRes.data ?? [])
        .map((row: any) => row.habitats)
        .filter(Boolean)
        .map((h: any) => ({
          id: h.id,
          label: h.habitat_code ?? h.name,
        })) as HabitatOption[];

      const memberOptions = (memberRes.data ?? [])
        .map((row: any) => ({
          id: row.user_id,
          username: row.profile?.username ?? 'Unknown',
        })) as MemberOption[];

      setHabitats(habitatOptions);
      setMembers(memberOptions);
      setLoadingOptions(false);
    };

    loadOptions();
  }, [groupId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a task title.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setSubmitting(false);
      return;
    }

    const dueDateValue = dueDate.trim() || null;
    if (dueDateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format for due date.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('steward_tasks').insert({
      steward_group_id: groupId,
      habitat_id: habitatId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: 'to_do',
      assigned_to: assignedTo,
      due_date: dueDateValue,
      created_by: user.id,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not create task', error.message);
    } else {
      Alert.alert('Task created', 'Your task has been added.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loadingOptions) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>New Task</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Remove invasive species along north trail"
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="Add details, location notes, or instructions..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        {TASK_PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, priority === p && styles.chipActive]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
              {TASK_PRIORITY_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Habitat (optional)</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, habitatId === null && styles.chipActive]}
          onPress={() => setHabitatId(null)}
        >
          <Text style={[styles.chipText, habitatId === null && styles.chipTextActive]}>None</Text>
        </TouchableOpacity>
        {habitats.map((h) => (
          <TouchableOpacity
            key={h.id}
            style={[styles.chip, habitatId === h.id && styles.chipActive]}
            onPress={() => setHabitatId(h.id)}
          >
            <Text style={[styles.chipText, habitatId === h.id && styles.chipTextActive]}>
              {h.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Assign to (optional)</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, assignedTo === null && styles.chipActive]}
          onPress={() => setAssignedTo(null)}
        >
          <Text style={[styles.chipText, assignedTo === null && styles.chipTextActive]}>Unassigned</Text>
        </TouchableOpacity>
        {members.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, assignedTo === m.id && styles.chipActive]}
            onPress={() => setAssignedTo(m.id)}
          >
            <Text style={[styles.chipText, assignedTo === m.id && styles.chipTextActive]}>
              {m.username}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Due date (optional)</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#aaa"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Create Task</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function CreateTaskScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <CreateTaskContent />
    </GroupMembersOnlyGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
    minHeight: 100,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 4,
  },
  chipActive: { backgroundColor: '#1a2e1a', borderColor: '#1a2e1a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  submitButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 40,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
