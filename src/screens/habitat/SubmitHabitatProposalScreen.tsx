import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { readFileAsText } from '../../lib/fileRead';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { parseKmlToPolygon, GeoJsonPolygon } from '../../lib/kml';
import {
  pickKmlFile,
  submitHabitatProposal,
  uploadProposalKml,
  fetchMyProposals,
  HabitatProposal,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_LABELS,
  MAX_HABITAT_LABELS,
  formatHabitatLabels,
  proposalHabitatLabels,
} from '../../lib/habitatProposals';
import { conditionTierLabel } from '../../lib/habitatOverview';
import BoundaryMapPreview from '../../components/habitat/BoundaryMapPreview';
import { Habitat } from '../map/WorldMapScreen';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubmitHabitatProposal'>;

export default function SubmitHabitatProposalScreen() {
  const navigation = useNavigation<Nav>();

  const [name, setName] = useState('');
  const [habitatLabels, setHabitatLabels] = useState<string[]>(['']);
  const [stewardGroupName, setStewardGroupName] = useState('');
  const [conditionRating, setConditionRating] = useState<number | null>(null);
  const [kmlFileName, setKmlFileName] = useState<string | null>(null);
  const [kmlUri, setKmlUri] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<GeoJsonPolygon | null>(null);
  const [pointCount, setPointCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [myProposals, setMyProposals] = useState<HabitatProposal[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProposals(false);
        return;
      }
      const proposals = await fetchMyProposals(user.id);
      setMyProposals(proposals);
      setLoadingProposals(false);
    };
    load();
  }, []);

  const cleanedLabels = useMemo(
    () => habitatLabels.map((label) => label.trim()).filter(Boolean),
    [habitatLabels],
  );

  const previewHabitat = useMemo((): Habitat[] => {
    if (!boundary) return [];
    return [{
      id: 'preview',
      name: 'Boundary preview',
      boundary,
      habitat_code: 'preview',
      habitat_type: null,
      region: null,
      color: '#4caf50',
    }];
  }, [boundary]);

  const updateLabel = (index: number, value: string) => {
    setHabitatLabels((prev) => prev.map((label, i) => (i === index ? value : label)));
  };

  const addLabel = () => {
    if (habitatLabels.length >= MAX_HABITAT_LABELS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_HABITAT_LABELS} habitat labels.`);
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

  const handlePickKml = async () => {
    const picked = await pickKmlFile();
    if (!picked) return;

    try {
      const kmlText = await readFileAsText(picked.uri);
      const parsed = parseKmlToPolygon(kmlText);
      if (!parsed.ok) {
        Alert.alert('Invalid KML', parsed.error);
        return;
      }

      setKmlUri(picked.uri);
      setKmlFileName(picked.name);
      setBoundary(parsed.polygon);
      setPointCount(parsed.pointCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read the KML file.';
      Alert.alert('Read failed', message);
    }
  };

  const handleClearKml = () => {
    setKmlUri(null);
    setKmlFileName(null);
    setBoundary(null);
    setPointCount(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter the habitat area name (e.g. Arroyo Seco).');
      return;
    }
    if (cleanedLabels.length === 0) {
      Alert.alert('Missing labels', 'Add at least one accepted, specific habitat name.');
      return;
    }
    if (!stewardGroupName.trim()) {
      Alert.alert('Missing steward group', 'Enter the steward group name for this habitat.');
      return;
    }
    if (!boundary) {
      Alert.alert('Missing boundary', 'Upload a KML file with a polygon boundary.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      Alert.alert('Sign in required', 'You must be signed in to propose a habitat.');
      return;
    }

    let kmlPath: string | null = null;
    if (kmlUri) {
      const { path, error: uploadError } = await uploadProposalKml(kmlUri, user.id);
      if (uploadError) {
        setSubmitting(false);
        Alert.alert('Upload failed', uploadError);
        return;
      }
      kmlPath = path;
    }

    const { data, error } = await submitHabitatProposal({
      name: name.trim(),
      habitat_labels: cleanedLabels,
      steward_group_name: stewardGroupName.trim(),
      condition_rating: conditionRating,
      boundary_geojson: boundary,
      kml_file_url: kmlPath,
    }, user.id);

    setSubmitting(false);

    if (error || !data) {
      Alert.alert('Submission failed', error ?? 'Could not save your proposal.');
      return;
    }

    setMyProposals((prev) => [data, ...prev]);
    setName('');
    setHabitatLabels(['']);
    setStewardGroupName('');
    setConditionRating(null);
    handleClearKml();

    Alert.alert(
      'Proposal submitted',
      'Admins will review your habitat boundary and details. You can track status below.',
    );
  };

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEnabled={scrollEnabled}
    >
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Propose a New Habitat</Text>
      <Text style={styles.subtitle}>
        Export a polygon boundary from Google Maps, Google Earth, QGIS, or ArcGIS as KML,
        then submit it for admin review — similar to iNaturalist place boundaries.
      </Text>

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

      <Text style={styles.label}>Boundary KML file</Text>
      <View style={styles.kmlBox}>
        {kmlFileName ? (
          <>
            <Text style={styles.kmlName}>{kmlFileName}</Text>
            {pointCount ? (
              <Text style={styles.kmlMeta}>Polygon loaded · {pointCount} boundary points</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.kmlEmpty}>No KML selected yet</Text>
        )}
      </View>

      <View style={styles.mediaButtonRow}>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePickKml}>
          <Text style={styles.mediaButtonText}>Choose KML file</Text>
        </TouchableOpacity>
        {kmlFileName ? (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearKml}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {previewHabitat.length > 0 ? (
        <>
          <Text style={styles.label}>Boundary preview</Text>
          <BoundaryMapPreview
            habitats={previewHabitat}
            onScrollLockChange={(locked) => setScrollEnabled(!locked)}
          />
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit for Review</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Your proposals</Text>
      {loadingProposals ? (
        <ActivityIndicator color="#4caf50" style={{ marginVertical: 16 }} />
      ) : myProposals.length === 0 ? (
        <Text style={styles.emptyText}>No proposals yet.</Text>
      ) : (
        myProposals.map((proposal) => (
          <View key={proposal.id} style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Text style={styles.proposalName}>{proposal.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: PROPOSAL_STATUS_COLORS[proposal.status] }]}>
                <Text style={styles.statusBadgeText}>{PROPOSAL_STATUS_LABELS[proposal.status]}</Text>
              </View>
            </View>
            <Text style={styles.proposalMeta}>
              {[formatHabitatLabels(proposalHabitatLabels(proposal)), proposal.steward_group_name].filter(Boolean).join(' · ')}
            </Text>
            {proposal.reviewer_notes ? (
              <Text style={styles.reviewerNotes}>Admin note: {proposal.reviewer_notes}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 8, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a2e1a', marginTop: 28, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 12 },
  fieldHint: { fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 17 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  labelInput: { flex: 1, marginBottom: 0 },
  addLabelButton: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingVertical: 6,
  },
  addLabelText: { fontSize: 13, fontWeight: '700', color: '#4caf50' },
  removeLabelButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  removeLabelText: { fontSize: 12, fontWeight: '700', color: '#c62828' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
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
  kmlBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    minHeight: 64,
    justifyContent: 'center',
  },
  kmlName: { fontSize: 15, fontWeight: '700', color: '#1a2e1a' },
  kmlMeta: { fontSize: 13, color: '#666', marginTop: 4 },
  kmlEmpty: { fontSize: 14, color: '#888' },
  mediaButtonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  mediaButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    paddingVertical: 12,
    alignItems: 'center',
  },
  mediaButtonText: { fontSize: 13, fontWeight: '700', color: '#4caf50' },
  clearButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c62828',
  },
  clearButtonText: { fontSize: 13, color: '#c62828', fontWeight: '700' },
  submitButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#888', marginBottom: 40 },
  proposalCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  proposalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  proposalName: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', flex: 1 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  proposalMeta: { fontSize: 13, color: '#666', marginTop: 6 },
  reviewerNotes: { fontSize: 13, color: '#555', marginTop: 8, fontStyle: 'italic' },
});
