import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { canSubmitContribution } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'AddContribution'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'AddContribution'>;

const CONTRIBUTION_TYPES = [
  'Plant Note',
  'Soil Note',
  'Water Note',
  'Habitat Condition Photo',
  'iNaturalist Link',
  'Other Evidence',
];

export default function AddContributionScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;
  const { role, loading: roleLoading } = useUserRole();

  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [inatLink, setInatLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!type) {
      Alert.alert('Missing Type', 'Please select a contribution type.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Missing Description', 'Please describe your contribution.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('contributions').insert({
      habitat_id: habitatId,
      user_id: user.id,
      type,
      title: title.trim(),
      description: body.trim(),
      inaturalist_link: inatLink.trim() || null,
      status: 'pending',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Submission Failed', error.message);
    } else {
      Alert.alert(
        'Submitted for Review',
        'Your contribution was submitted for verifier review.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  };

  if (roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!canSubmitContribution(role)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Contributor Role Required</Text>
        <Text style={styles.deniedSubtitle}>
          Only contributors and above can submit formal contributions.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <TouchableOpacity
        onPress={() => { Keyboard.dismiss(); navigation.goBack(); }}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Submit Contribution</Text>
      <Text style={styles.subtitle}>
        Contributions are reviewed by a verifier before becoming official.
      </Text>

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipGrid}>
        {CONTRIBUTION_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, type === t && styles.chipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Native grass coverage declining"
        placeholderTextColor="#aaa"
        value={title}
        onChangeText={setTitle}
        returnKeyType="next"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Describe your contribution in detail..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={5}
        value={body}
        onChangeText={setBody}
        textAlignVertical="top"
      />

      <Text style={styles.label}>iNaturalist Link <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="https://www.inaturalist.org/observations/..."
        placeholderTextColor="#aaa"
        value={inatLink}
        onChangeText={setInatLink}
        autoCapitalize="none"
        keyboardType="url"
      />

      <TouchableOpacity style={styles.photoPlaceholder} disabled>
        <Text style={styles.photoPlaceholderText}>📷  Photo upload — coming soon</Text>
      </TouchableOpacity>

      <View style={styles.reviewNote}>
        <Text style={styles.reviewNoteText}>
          ⏳  This will not appear publicly until a verifier approves it.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitButtonText}>Submit for Review</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
    marginTop: 48,
  },
  backText: {
    fontSize: 15,
    color: '#4caf50',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a2e1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  optional: {
    fontSize: 11,
    fontWeight: '400',
    color: '#aaa',
    textTransform: 'none',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  chipText: {
    fontSize: 13,
    color: '#555',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    fontSize: 15,
    color: '#111',
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    fontSize: 15,
    color: '#111',
    minHeight: 120,
    marginBottom: 20,
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#aaa',
  },
  reviewNote: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  reviewNoteText: {
    fontSize: 13,
    color: '#7a6000',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f5f5f0',
  },
  deniedIcon: { fontSize: 48, marginBottom: 16 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
