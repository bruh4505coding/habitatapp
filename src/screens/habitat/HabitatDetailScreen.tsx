import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GlobalSearchBar from '../../components/GlobalSearchBar';
import { useUserRole } from '../../hooks/useUserRole';
import {
  canSubmitContribution, canSubmitBoundaryEdit,
} from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'HabitatDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'HabitatDetail'>;
type Tab = 'overview' | 'observations' | 'contributions' | 'boundary' | 'verification';

type HabitatData = {
  id: string;
  name: string;
  habitat_code: string | null;
  habitat_type: string | null;
  description: string | null;
  region: string | null;
  status: string | null;
  color: string | null;
  last_verified_at: string | null;
};

type Observation = {
  id: string;
  species: string;
  notes: string | null;
  created_at: string;
};

type Contribution = {
  id: string;
  type: string;
  description: string | null;
  created_at: string;
};

type BoundaryEdit = {
  id: string;
  description: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  boundary_edit_id: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: '#4caf50',
  inactive: '#888888',
  pending: '#ff9800',
  approved: '#4caf50',
  rejected: '#e53935',
};

export default function HabitatDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;
  const { role: userRole } = useUserRole();

  const canContribute = canSubmitContribution(userRole);
  const canEditBoundary = canSubmitBoundaryEdit(userRole);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [habitat, setHabitat] = useState<HabitatData | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [boundaryEdits, setBoundaryEdits] = useState<BoundaryEdit[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: habitatData, error } = await supabase
        .from('habitats')
        .select('id, name, habitat_code, habitat_type, description, region, status, color, last_verified_at')
        .eq('id', habitatId)
        .single();

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      setHabitat(habitatData);

      const { data: obsData } = await supabase
        .from('observations')
        .select('id, species, notes, created_at')
        .eq('habitat_id', habitatId)
        .order('created_at', { ascending: false });

      const { data: contribData } = await supabase
        .from('contributions')
        .select('id, type, description, created_at')
        .eq('habitat_id', habitatId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      const { data: editData } = await supabase
        .from('boundary_edits')
        .select('id, description, created_at, status')
        .eq('habitat_id', habitatId)
        .order('created_at', { ascending: false });

      const editIds = (editData ?? []).map((e) => e.id);
      let subData: Submission[] = [];
      if (editIds.length > 0) {
        const { data: fetched } = await supabase
          .from('submissions')
          .select('id, status, notes, created_at, boundary_edit_id')
          .in('boundary_edit_id', editIds)
          .order('created_at', { ascending: false });
        subData = fetched ?? [];
      }

      setObservations(obsData ?? []);
      setContributions(contribData ?? []);
      setBoundaryEdits(editData ?? []);
      setSubmissions(subData);
      setLoading(false);
    };

    fetchAll();
  }, [habitatId]);

  useEffect(() => {
    if (!canContribute && (activeTab === 'contributions' || activeTab === 'boundary')) {
      setActiveTab('overview');
    }
  }, [canContribute, activeTab]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!habitat) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Habitat not found.</Text>
      </View>
    );
  }

  const accent = habitat.color ?? '#4caf50';

  const renderOverview = () => (
    <View style={styles.section}>
      {habitat.description ? (
        <Text style={styles.description}>{habitat.description}</Text>
      ) : (
        <Text style={styles.empty}>No description added yet.</Text>
      )}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Type</Text>
        <Text style={styles.infoValue}>{habitat.habitat_type ?? '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Region</Text>
        <Text style={styles.infoValue}>{habitat.region ?? '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Status</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[habitat.status ?? 'active'] }]}>
          <Text style={styles.badgeText}>{habitat.status ?? 'active'}</Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Last Verified</Text>
        <Text style={styles.infoValue}>
          {habitat.last_verified_at
            ? new Date(habitat.last_verified_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : 'Not yet verified'}
        </Text>
      </View>
    </View>
  );

  const renderObservations = () => (
    <View style={styles.section}>
      {observations.length === 0 ? (
        <Text style={styles.empty}>No observations yet.</Text>
      ) : (
        observations.map((obs) => (
          <View key={obs.id} style={styles.card}>
            <Text style={styles.cardTitle}>{obs.species}</Text>
            {obs.notes ? <Text style={styles.cardSubtitle}>{obs.notes}</Text> : null}
            <Text style={styles.cardDate}>{new Date(obs.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
      <TouchableOpacity
        style={[styles.actionButton, { borderColor: accent }]}
        onPress={() => navigation.navigate('AddObservation', { habitatId })}
      >
        <Text style={[styles.actionButtonText, { color: accent }]}>+ Add Observation</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContributions = () => (
    <View style={styles.section}>
      {contributions.length === 0 ? (
        <Text style={styles.empty}>No approved contributions yet.</Text>
      ) : (
        contributions.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.cardTitle}>{c.type}</Text>
            {c.description ? <Text style={styles.cardSubtitle}>{c.description}</Text> : null}
            <Text style={styles.cardDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
      {canContribute ? (
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: accent }]}
          onPress={() => navigation.navigate('AddContribution', { habitatId })}
        >
          <Text style={[styles.actionButtonText, { color: accent }]}>+ Submit Contribution</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.lockedBox}>
          <Text style={styles.lockedText}>
            Contributor role required to submit formal contributions.
          </Text>
        </View>
      )}
    </View>
  );

  const renderBoundary = () => {
    const pending = boundaryEdits.filter((e) => {
      const sub = submissions.find((s) => s.boundary_edit_id === e.id);
      return !sub || sub.status === 'pending';
    });

    return (
      <View style={styles.section}>
        <Text style={styles.subSectionTitle}>Current Official Boundary</Text>
        <Text style={styles.infoValue}>A boundary polygon is on file for this habitat.</Text>

        <Text style={[styles.subSectionTitle, { marginTop: 20 }]}>Pending Edits</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>No pending boundary edits.</Text>
        ) : (
          pending.map((e) => (
            <View key={e.id} style={styles.card}>
              <Text style={styles.cardTitle}>Edit Proposal</Text>
              {e.description ? <Text style={styles.cardSubtitle}>{e.description}</Text> : null}
              <Text style={styles.cardDate}>{new Date(e.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        )}
        {canEditBoundary ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: accent }]}
            onPress={() => navigation.navigate('SubmitBoundaryEdit', { habitatId })}
          >
            <Text style={[styles.actionButtonText, { color: accent }]}>Suggest Boundary Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedText}>
              Contributor role required to suggest boundary edits.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderVerification = () => (
    <View style={styles.section}>
      {submissions.length === 0 ? (
        <Text style={styles.empty}>No verification history yet.</Text>
      ) : (
        submissions.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>Boundary Edit Review</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[s.status] ?? '#888' }]}>
                <Text style={styles.badgeText}>{s.status}</Text>
              </View>
            </View>
            {s.notes ? <Text style={styles.cardSubtitle}>{s.notes}</Text> : null}
            <Text style={styles.cardDate}>{new Date(s.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </View>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'observations', label: 'Observations' },
    { key: 'contributions', label: 'Contributions' },
    { key: 'boundary', label: 'Boundary' },
    { key: 'verification', label: 'Verification' },
  ];

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'contributions' || tab.key === 'boundary') {
      return canContribute;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: accent }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.searchRow}>
          <GlobalSearchBar fullWidth variant="light" />
        </View>
        <Text style={styles.habitatCode}>{habitat.habitat_code ?? habitat.name}</Text>
        <Text style={styles.habitatType}>{habitat.habitat_type ?? ''}</Text>
        <View style={styles.metaRow}>
          {habitat.region ? <Text style={styles.metaText}>{habitat.region}</Text> : null}
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[habitat.status ?? 'active'] ?? '#888', marginLeft: 8 }]}>
            <Text style={styles.badgeText}>{habitat.status ?? 'active'}</Text>
          </View>
        </View>
        {habitat.last_verified_at ? (
          <Text style={styles.verifiedText}>
            Last verified: {new Date(habitat.last_verified_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {visibleTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: accent, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: accent, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'observations' && renderObservations()}
        {activeTab === 'contributions' && renderContributions()}
        {activeTab === 'boundary' && renderBoundary()}
        {activeTab === 'verification' && renderVerification()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#555' },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: 56,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  searchRow: { marginBottom: 12, zIndex: 100 },
  habitatCode: { fontSize: 22, fontWeight: '800', color: '#1a2e1a' },
  habitatType: { fontSize: 14, color: '#666', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaText: { fontSize: 13, color: '#555' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  verifiedText: { fontSize: 12, color: '#888', marginTop: 6 },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 48,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: -1,
  },
  tabText: { fontSize: 13, color: '#888' },
  content: { flex: 1 },
  section: { padding: 20 },
  description: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 20 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 14, color: '#1a2e1a', fontWeight: '500' },
  empty: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a2e1a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#666', marginBottom: 4 },
  cardDate: { fontSize: 12, color: '#aaa' },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: { fontSize: 15, fontWeight: '700' },
  lockedBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lockedText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
});
