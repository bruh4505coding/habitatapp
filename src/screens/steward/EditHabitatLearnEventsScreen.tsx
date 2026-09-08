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
  upsertOverviewLearnEvents,
  LearnLink,
  OverviewEvent,
  MAX_LEARN_LINKS,
  MAX_OVERVIEW_EVENTS,
} from '../../lib/habitatOverview';
import { useUserRole } from '../../hooks/useUserRole';
import { canManageUsers } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'EditHabitatLearnEvents'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMPTY_LINK: LearnLink = { title: '', url: '' };
const EMPTY_EVENT: OverviewEvent = { title: '', description: '' };

function normalizeLinks(rows: LearnLink[]): LearnLink[] {
  return rows
    .map((row) => ({ title: row.title.trim(), url: row.url.trim() }))
    .filter((row) => row.title && row.url);
}

function normalizeEvents(rows: OverviewEvent[]): OverviewEvent[] {
  return rows
    .map((row) => ({ title: row.title.trim(), description: row.description.trim() }))
    .filter((row) => row.title);
}

export default function EditHabitatLearnEventsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId, groupId } = route.params;
  const { memberRole, loading: membershipLoading } = useGroupMembership(groupId);
  const { role: platformRole, loading: roleLoading } = useUserRole();

  const [learnLinks, setLearnLinks] = useState<LearnLink[]>([{ ...EMPTY_LINK }]);
  const [events, setEvents] = useState<OverviewEvent[]>([{ ...EMPTY_EVENT }]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = canManageUsers(platformRole) || isGroupLeadOrManager(memberRole);

  useEffect(() => {
    const load = async () => {
      const overview = await fetchHabitatOverview(groupId, habitatId);
      if (overview) {
        setLearnLinks(
          overview.learn_links.length > 0
            ? overview.learn_links
            : [{ ...EMPTY_LINK }],
        );
        setEvents(
          overview.events.length > 0
            ? overview.events
            : [{ ...EMPTY_EVENT }],
        );
      }
      setLoading(false);
    };

    load();
  }, [groupId, habitatId]);

  const updateLink = (index: number, field: keyof LearnLink, value: string) => {
    setLearnLinks((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const updateEvent = (index: number, field: keyof OverviewEvent, value: string) => {
    setEvents((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addLink = () => {
    if (learnLinks.length >= MAX_LEARN_LINKS) return;
    setLearnLinks((prev) => [...prev, { ...EMPTY_LINK }]);
  };

  const removeLink = (index: number) => {
    setLearnLinks((prev) => (prev.length <= 1 ? [{ ...EMPTY_LINK }] : prev.filter((_, i) => i !== index)));
  };

  const addEvent = () => {
    if (events.length >= MAX_OVERVIEW_EVENTS) return;
    setEvents((prev) => [...prev, { ...EMPTY_EVENT }]);
  };

  const removeEvent = (index: number) => {
    setEvents((prev) => (prev.length <= 1 ? [{ ...EMPTY_EVENT }] : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    const links = normalizeLinks(learnLinks);
    const eventRows = normalizeEvents(events);

    for (const link of links) {
      if (!/^https?:\/\//i.test(link.url)) {
        Alert.alert('Invalid link', `Add a full URL starting with http:// or https:// for "${link.title}".`);
        return;
      }
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      Alert.alert('Sign in required', 'You must be signed in to save changes.');
      return;
    }

    const { error } = await upsertOverviewLearnEvents(
      groupId,
      habitatId,
      links,
      eventRows,
      user.id,
    );

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not save', error);
    } else {
      Alert.alert('Saved', 'Learn links and events have been updated.', [
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
        <Text style={styles.denied}>Only group leads, managers, and system admins can edit learn links and events.</Text>
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

      <Text style={styles.title}>Edit Learn & Events</Text>
      <Text style={styles.subtitle}>Up to {MAX_LEARN_LINKS} links and {MAX_OVERVIEW_EVENTS} events</Text>

      <Text style={styles.sectionTitle}>Learn links</Text>
      {learnLinks.map((link, index) => (
        <View key={`link-${index}`} style={styles.block}>
          <Text style={styles.blockLabel}>Link {index + 1}</Text>
          <TextInput
            style={styles.input}
            value={link.title}
            onChangeText={(value) => updateLink(index, 'title', value)}
            placeholder="Link title"
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={styles.input}
            value={link.url}
            onChangeText={(value) => updateLink(index, 'url', value)}
            placeholder="https://..."
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity onPress={() => removeLink(index)} style={styles.removeButton}>
            <Text style={styles.removeText}>Remove link</Text>
          </TouchableOpacity>
        </View>
      ))}

      {learnLinks.length < MAX_LEARN_LINKS ? (
        <TouchableOpacity style={styles.addButton} onPress={addLink}>
          <Text style={styles.addButtonText}>+ Add link</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionTitle}>Events</Text>
      {events.map((event, index) => (
        <View key={`event-${index}`} style={styles.block}>
          <Text style={styles.blockLabel}>Event {index + 1}</Text>
          <TextInput
            style={styles.input}
            value={event.title}
            onChangeText={(value) => updateEvent(index, 'title', value)}
            placeholder="Event title"
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={event.description}
            onChangeText={(value) => updateEvent(index, 'description', value)}
            placeholder="Event description (shown when visitors tap the event)"
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity onPress={() => removeEvent(index)} style={styles.removeButton}>
            <Text style={styles.removeText}>Remove event</Text>
          </TouchableOpacity>
        </View>
      ))}

      {events.length < MAX_OVERVIEW_EVENTS ? (
        <TouchableOpacity style={styles.addButton} onPress={addEvent}>
          <Text style={styles.addButtonText}>+ Add event</Text>
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
          <Text style={styles.submitText}>Save Learn & Events</Text>
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
  block: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 10,
  },
  blockLabel: { fontSize: 13, fontWeight: '700', color: '#1a2e1a', marginBottom: 8 },
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
  textArea: { minHeight: 90 },
  removeButton: { alignSelf: 'flex-start' },
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
