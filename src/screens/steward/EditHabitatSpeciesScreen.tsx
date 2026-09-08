import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { isGroupLeadOrManager } from '../../lib/groupRoles';
import {
  fetchHabitatOverview,
  upsertOverviewSpecies,
  MAX_CHARACTERISTIC_SPECIES,
} from '../../lib/habitatOverview';
import { useUserRole } from '../../hooks/useUserRole';
import { canManageUsers } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'EditHabitatSpecies'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function normalizeSpecies(rows: string[]): string[] {
  return rows
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .slice(0, MAX_CHARACTERISTIC_SPECIES);
}

export default function EditHabitatSpeciesScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId, groupId } = route.params;
  const { memberRole, loading: membershipLoading } = useGroupMembership(groupId);
  const { role: platformRole, loading: roleLoading } = useUserRole();

  const [flora, setFlora] = useState<string[]>(['']);
  const [fauna, setFauna] = useState<string[]>(['']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = canManageUsers(platformRole) || isGroupLeadOrManager(memberRole);

  useEffect(() => {
    const load = async () => {
      const overview = await fetchHabitatOverview(groupId, habitatId);
      if (overview) {
        setFlora(
          overview.characteristic_flora.length > 0
            ? overview.characteristic_flora
            : [''],
        );
        setFauna(
          overview.characteristic_fauna.length > 0
            ? overview.characteristic_fauna
            : [''],
        );
      }
      setLoading(false);
    };

    load();
  }, [groupId, habitatId]);

  const updateFlora = (index: number, value: string) => {
    setFlora((prev) => prev.map((row, i) => (i === index ? value : row)));
  };

  const updateFauna = (index: number, value: string) => {
    setFauna((prev) => prev.map((row, i) => (i === index ? value : row)));
  };

  const addFlora = () => {
    if (flora.length >= MAX_CHARACTERISTIC_SPECIES) return;
    setFlora((prev) => [...prev, '']);
  };

  const removeFlora = (index: number) => {
    setFlora((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)));
  };

  const addFauna = () => {
    if (fauna.length >= MAX_CHARACTERISTIC_SPECIES) return;
    setFauna((prev) => [...prev, '']);
  };

  const removeFauna = (index: number) => {
    setFauna((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      Alert.alert('Sign in required', 'You must be signed in to save changes.');
      return;
    }

    const { error } = await upsertOverviewSpecies(
      groupId,
      habitatId,
      normalizeSpecies(flora),
      normalizeSpecies(fauna),
      user.id,
    );

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not save', error);
    } else {
      Alert.alert('Saved', 'Characteristic species have been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading || membershipLoading || roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Only group leads, managers, and system admins can edit characteristic species.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Edit Characteristic Species</Text>
      <Text style={styles.subtitle}>Up to {MAX_CHARACTERISTIC_SPECIES} flora and fauna entries each</Text>

      <Text style={styles.sectionTitle}>Flora</Text>
      {flora.map((item, index) => (
        <View key={`flora-${index}`} style={styles.row}>
          <TextInput
            style={styles.input}
            value={item}
            onChangeText={(value) => updateFlora(index, value)}
            placeholder="Plant species name"
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity onPress={() => removeFlora(index)} hitSlop={8}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      {flora.length < MAX_CHARACTERISTIC_SPECIES ? (
        <TouchableOpacity style={styles.addButton} onPress={addFlora}>
          <Text style={styles.addButtonText}>+ Add flora</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionTitle}>Fauna</Text>
      {fauna.map((item, index) => (
        <View key={`fauna-${index}`} style={styles.row}>
          <TextInput
            style={styles.input}
            value={item}
            onChangeText={(value) => updateFauna(index, value)}
            placeholder="Animal species name"
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity onPress={() => removeFauna(index)} hitSlop={8}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      {fauna.length < MAX_CHARACTERISTIC_SPECIES ? (
        <TouchableOpacity style={styles.addButton} onPress={addFauna}>
          <Text style={styles.addButtonText}>+ Add fauna</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Species</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
    marginBottom: 8,
  },
  removeText: { fontSize: 13, color: '#c62828', fontWeight: '600' },
  addButton: {
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  addButtonText: { fontSize: 14, fontWeight: '700', color: '#4caf50' },
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
  denied: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', textAlign: 'center', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
