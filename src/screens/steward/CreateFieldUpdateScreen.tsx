import React, { useState } from 'react';
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
  FIELD_UPDATE_CATEGORIES,
  FIELD_UPDATE_CATEGORY_LABELS,
  FieldUpdateCategory,
  FieldUpdateVisibility,
} from '../../lib/fieldUpdates';

type Route = RouteProp<RootStackParamList, 'CreateFieldUpdate'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type HabitatOption = { id: string; label: string };

function CreateFieldUpdateContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<FieldUpdateCategory>('habitat_condition');
  const [visibility, setVisibility] = useState<FieldUpdateVisibility>('private');
  const [habitatId, setHabitatId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [habitats, setHabitats] = useState<HabitatOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    const loadHabitats = async () => {
      const { data } = await supabase
        .from('habitat_group_access')
        .select('habitats ( id, name, habitat_code )')
        .eq('group_id', groupId)
        .eq('status', 'active');

      const options = (data ?? [])
        .map((row: any) => row.habitats)
        .filter(Boolean)
        .map((h: any) => ({
          id: h.id,
          label: h.habitat_code ?? h.name,
        })) as HabitatOption[];

      setHabitats(options);
      setLoadingOptions(false);
    };

    loadHabitats();
  }, [groupId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title for this update.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Missing body', 'Please describe what you observed in the field.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('field_updates').insert({
      steward_group_id: groupId,
      habitat_id: habitatId,
      user_id: user.id,
      title: title.trim(),
      body: body.trim(),
      category,
      photo_url: photoUrl.trim() || null,
      visibility,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not post update', error.message);
    } else {
      const visibilityNote = visibility === 'public'
        ? 'It is visible on the public group page.'
        : 'Only group members can see it.';
      Alert.alert('Field update posted', visibilityNote, [
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

      <Text style={styles.title}>New Field Update</Text>
      <Text style={styles.subtitle}>
        Document conditions, species sightings, safety notes, and restoration progress from the field.
      </Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Heavy erosion after winter rains"
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Update *</Text>
      <TextInput
        style={styles.textArea}
        value={body}
        onChangeText={setBody}
        placeholder="What did you observe? Include location details if helpful."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {FIELD_UPDATE_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {FIELD_UPDATE_CATEGORY_LABELS[c]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[styles.visibilityOption, visibility === 'private' && styles.visibilityOptionActive]}
          onPress={() => setVisibility('private')}
        >
          <Text style={[styles.visibilityTitle, visibility === 'private' && styles.visibilityTitleActive]}>
            Private
          </Text>
          <Text style={styles.visibilityDesc}>Only group members can see this</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.visibilityOption, visibility === 'public' && styles.visibilityOptionActive]}
          onPress={() => setVisibility('public')}
        >
          <Text style={[styles.visibilityTitle, visibility === 'public' && styles.visibilityTitleActive]}>
            Public
          </Text>
          <Text style={styles.visibilityDesc}>Shown on the public group page</Text>
        </TouchableOpacity>
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

      <Text style={styles.label}>Photo URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={photoUrl}
        onChangeText={setPhotoUrl}
        placeholder="https://..."
        placeholderTextColor="#aaa"
        autoCapitalize="none"
        keyboardType="url"
      />

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Post Field Update</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function CreateFieldUpdateScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <CreateFieldUpdateContent />
    </GroupMembersOnlyGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 20 },
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
    minHeight: 120,
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
  visibilityRow: { flexDirection: 'row', gap: 10 },
  visibilityOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  visibilityOptionActive: { borderColor: '#4caf50', backgroundColor: '#f1f8f1' },
  visibilityTitle: { fontSize: 15, fontWeight: '700', color: '#666', marginBottom: 4 },
  visibilityTitleActive: { color: '#1a2e1a' },
  visibilityDesc: { fontSize: 12, color: '#888', lineHeight: 16 },
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
