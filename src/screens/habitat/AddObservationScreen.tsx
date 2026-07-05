import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';

type Route = RouteProp<RootStackParamList, 'AddObservation'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'AddObservation'>;

const CATEGORIES = [
  'Plants',
  'Soil',
  'Water',
  'Invasive Species',
  'Erosion',
  'Seasonal Condition',
  'Human Disturbance',
  'Other',
];

export default function AddObservationScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;

  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Missing Category', 'Please select a category.');
      return;
    }
    if (!text.trim()) {
      Alert.alert('Missing Text', 'Please describe your observation.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('observations').insert({
      habitat_id: habitatId,
      user_id: user.id,
      category,
      notes: text.trim(),
      status: 'visible',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Submission Failed', error.message);
    } else {
      Alert.alert('Observation Posted', 'Your observation is now visible.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add Observation</Text>
      <Text style={styles.subtitle}>
        Share what you see at this habitat. No approval needed — your observation is posted immediately.
      </Text>

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Observation</Text>
      <TextInput
        style={styles.textArea}
        placeholder={`e.g. Mustard appears denser along the western trail edge.`}
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={5}
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.photoPlaceholder} disabled>
        <Text style={styles.photoPlaceholderText}>📷  Photo upload — coming soon</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitButtonText}>Submit Observation</Text>}
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
  categoryGrid: {
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
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    fontSize: 15,
    color: '#111',
    minHeight: 120,
    marginBottom: 16,
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: '#fafafa',
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#aaa',
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
});
