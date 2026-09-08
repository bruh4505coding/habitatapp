import React, { useEffect, useMemo, useState, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { canManageUsers, normalizeUserRole } from '../../lib/roles';
import {
  approveHabitatProposal,
  fetchProposalById,
  HabitatProposal,
  rejectHabitatProposal,
  formatHabitatLabels,
  proposalHabitatLabels,
  MAX_HABITAT_LABELS,
} from '../../lib/habitatProposals';
import { conditionTierLabel } from '../../lib/habitatOverview';
import BoundaryMapPreview from '../../components/habitat/BoundaryMapPreview';
import { Habitat } from '../map/WorldMapScreen';

type Route = RouteProp<RootStackParamList, 'ReviewHabitatProposalDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAP_PREVIEW_HEIGHT = 240;

const ProposalBoundaryMap = memo(function ProposalBoundaryMap({
  proposal,
}: {
  proposal: HabitatProposal;
}) {
  const previewHabitat = useMemo((): Habitat[] => [{
    id: proposal.id,
    name: proposal.name,
    boundary: proposal.boundary_geojson,
    habitat_code: proposal.name,
    habitat_type: null,
    region: null,
    color: '#4caf50',
  }], [proposal.id, proposal.boundary_geojson]);

  return (
    <BoundaryMapPreview
      habitats={previewHabitat}
      height={MAP_PREVIEW_HEIGHT}
      nestedInScrollView={false}
    />
  );
});

export default function ReviewHabitatProposalDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { proposalId } = route.params;

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [proposal, setProposal] = useState<HabitatProposal | null>(null);
  const [name, setName] = useState('');
  const [habitatLabels, setHabitatLabels] = useState<string[]>(['']);
  const [stewardGroupName, setStewardGroupName] = useState('');
  const [conditionRating, setConditionRating] = useState<number | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!canManageUsers(normalizeUserRole(profile?.role))) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const row = await fetchProposalById(proposalId);
      if (row) {
        setProposal(row);
        setName(row.name);
        const labels = proposalHabitatLabels(row);
        setHabitatLabels(labels.length > 0 ? labels : ['']);
        setStewardGroupName(row.steward_group_name);
        setConditionRating(row.condition_rating);
      }
      setLoading(false);
    };

    load();
  }, [proposalId]);

  const cleanedLabels = useMemo(
    () => habitatLabels.map((label) => label.trim()).filter(Boolean),
    [habitatLabels],
  );

  const updateLabel = (index: number, value: string) => {
    setHabitatLabels((prev) => prev.map((label, i) => (i === index ? value : label)));
  };

  const addLabel = () => {
    if (habitatLabels.length >= MAX_HABITAT_LABELS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_HABITAT_LABELS} habitat names.`);
      return;
    }
    setHabitatLabels((prev) => [...prev, '']);
  };

  const removeLabel = (index: number) => {
    if (habitatLabels.length === 1) {
      setHabitatLabels(['']);
      return;
    }
    setHabitatLabels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    if (!proposal) return;

    const moderated = {
      name: name.trim(),
      habitat_labels: cleanedLabels,
      steward_group_name: stewardGroupName.trim(),
      condition_rating: conditionRating,
    };

    if (!moderated.name) {
      Alert.alert('Missing name', 'Enter the habitat area name.');
      return;
    }
    if (moderated.habitat_labels.length === 0) {
      Alert.alert('Missing habitat names', 'Add at least one habitat name.');
      return;
    }
    if (!moderated.steward_group_name) {
      Alert.alert('Missing steward group', 'Enter the steward group name.');
      return;
    }

    Alert.alert(
      'Approve habitat?',
      `This will create "${moderated.name}" on the map using your edited details.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              setProcessing(false);
              return;
            }

            const { habitatId, error } = await approveHabitatProposal(
              proposal,
              user.id,
              moderated,
              reviewerNotes,
            );
            setProcessing(false);

            if (error) {
              Alert.alert('Approval issue', error);
              return;
            }

            Alert.alert('Approved', 'The habitat has been created with your edits.', [
              {
                text: 'View habitat',
                onPress: () => habitatId && navigation.replace('HabitatDetail', { habitatId }),
              },
              { text: 'Done', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!proposal) return;

    Alert.alert(
      'Reject proposal?',
      'The submitter will see this marked as rejected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              setProcessing(false);
              return;
            }

            const { error } = await rejectHabitatProposal(proposal.id, user.id, reviewerNotes);
            setProcessing(false);

            if (error) {
              Alert.alert('Could not reject', error);
              return;
            }

            Alert.alert('Rejected', 'The proposal has been rejected.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Only system admins can review habitat proposals.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!proposal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Proposal not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (proposal.status !== 'pending') {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>This proposal has already been {proposal.status}.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapHeader}>
        <ProposalBoundaryMap proposal={proposal} />
      </View>

      <KeyboardAvoidingView
        style={styles.formArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Review Proposal</Text>
      <Text style={styles.subtitle}>
        Edit any details before approving — fix typos or incorrect habitat names without sending it back.
      </Text>

      <View style={styles.metaCard}>
        <Text style={styles.metaRow}>
          <Text style={styles.metaLabel}>Submitted by: </Text>
          {proposal.submitter?.username ?? 'Unknown'}
        </Text>
        <Text style={styles.metaRow}>
          <Text style={styles.metaLabel}>Submitted: </Text>
          {new Date(proposal.created_at).toLocaleString()}
        </Text>
      </View>

      <Text style={styles.label}>Habitat area name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Arroyo Seco"
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Habitat names</Text>
      <Text style={styles.fieldHint}>
        Any accepted, specific habitat name. Add up to {MAX_HABITAT_LABELS}.
      </Text>
      {habitatLabels.map((label, index) => (
        <View key={`label-${index}`} style={styles.labelRow}>
          <TextInput
            style={[styles.input, styles.labelInput]}
            value={label}
            onChangeText={(value) => updateLabel(index, value)}
            placeholder={index === 0 ? 'e.g. Maritime chaparral, California sage scrub' : 'Another habitat name'}
            placeholderTextColor="#aaa"
            autoCapitalize="none"
          />
          {habitatLabels.length > 1 ? (
            <TouchableOpacity style={styles.removeLabelButton} onPress={() => removeLabel(index)}>
              <Text style={styles.removeLabelText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {habitatLabels.length < MAX_HABITAT_LABELS ? (
        <TouchableOpacity style={styles.addLabelButton} onPress={addLabel}>
          <Text style={styles.addLabelText}>+ Add another habitat name</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.label}>Steward group name</Text>
      <TextInput
        style={styles.input}
        value={stewardGroupName}
        onChangeText={setStewardGroupName}
        placeholder="Group that stewards this habitat"
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Intact / condition rating (optional)</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, conditionRating === null && styles.chipActive]}
          onPress={() => setConditionRating(null)}
        >
          <Text style={[styles.chipText, conditionRating === null && styles.chipTextActive]}>Not set</Text>
        </TouchableOpacity>
        {[1, 2, 3, 4, 5].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, conditionRating === r && styles.chipActive]}
            onPress={() => setConditionRating(r)}
          >
            <Text style={[styles.chipText, conditionRating === r && styles.chipTextActive]}>
              {r} · {conditionTierLabel(r)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Reviewer notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={reviewerNotes}
        onChangeText={setReviewerNotes}
        multiline
        numberOfLines={3}
        placeholder="Notes for the submitter or your records"
        placeholderTextColor="#aaa"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.rejectButton, processing && styles.buttonDisabled]}
          onPress={handleReject}
          disabled={processing}
        >
          {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.rejectText}>Reject</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approveButton, processing && styles.buttonDisabled]}
          onPress={handleApprove}
          disabled={processing}
        >
          {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Approve & Create Habitat</Text>}
        </TouchableOpacity>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0f4f0' },
  mapHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    height: 56 + 12 + MAP_PREVIEW_HEIGHT,
    backgroundColor: '#f0f4f0',
  },
  formArea: { flex: 1 },
  formScroll: { flex: 1 },
  formContent: { paddingHorizontal: 20, paddingBottom: 40 },
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },
  metaCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 4,
  },
  metaRow: { fontSize: 13, color: '#555', marginBottom: 4 },
  metaLabel: { fontWeight: '700', color: '#1a2e1a' },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 12 },
  fieldHint: { fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 17 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  labelInput: { flex: 1, marginBottom: 0 },
  addLabelButton: { alignSelf: 'flex-start', marginBottom: 4, paddingVertical: 6 },
  addLabelText: { fontSize: 13, fontWeight: '700', color: '#4caf50' },
  removeLabelButton: { paddingHorizontal: 10, paddingVertical: 10 },
  removeLabelText: { fontSize: 12, fontWeight: '700', color: '#c62828' },
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 40 },
  rejectButton: {
    flex: 1,
    backgroundColor: '#c62828',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  approveButton: {
    flex: 2,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  rejectText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  denied: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', textAlign: 'center', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
