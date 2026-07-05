import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { canReviewSubmissions, isUserRole } from '../../lib/roles';
import GlobalSearchBar from '../../components/GlobalSearchBar';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VerifierDashboard'>;
type Tab = 'contributions' | 'boundary_edits' | 'observations' | 'approved' | 'rejected';

type ReviewItem = {
  id: string;
  type: 'contribution' | 'boundary_edit';
  habitatCode: string;
  submittedBy: string;
  date: string;
  preview: string;
  submissionType: string;
  status: string;
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'contributions', label: 'Contributions' },
  { key: 'boundary_edits', label: 'Boundary Edits' },
  { key: 'observations', label: 'Flagged Obs.' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function VerifierDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<Tab>('contributions');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [pendingContributions, setPendingContributions] = useState<ReviewItem[]>([]);
  const [pendingBoundaryEdits, setPendingBoundaryEdits] = useState<ReviewItem[]>([]);
  const [approvedItems, setApprovedItems] = useState<ReviewItem[]>([]);
  const [rejectedItems, setRejectedItems] = useState<ReviewItem[]>([]);

  useFocusEffect(useCallback(() => {
    const fetchAll = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccessDenied(true); setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!canReviewSubmissions(isUserRole(profile?.role) ? profile.role : null)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const [contribRes, editRes, resolvedContribRes, resolvedEditRes] = await Promise.all([
        supabase
          .from('contributions')
          .select('id, type, title, description, created_at, status, habitat_id, user_id, habitats(name, habitat_code)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('boundary_edits')
          .select('id, description, created_at, status, habitat_id, user_id, habitats(name, habitat_code)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('contributions')
          .select('id, type, title, description, created_at, status, habitat_id, user_id')
          .in('status', ['approved', 'rejected', 'changes_requested'])
          .order('created_at', { ascending: false })
          .limit(20),

        supabase
          .from('boundary_edits')
          .select('id, description, created_at, status, habitat_id, user_id')
          .in('status', ['approved', 'rejected', 'changes_requested'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      // Collect all unique user IDs and habitat IDs, fetch in parallel
      const allRows = [
        ...(contribRes.data ?? []),
        ...(editRes.data ?? []),
        ...(resolvedContribRes.data ?? []),
        ...(resolvedEditRes.data ?? []),
      ];
      const userIds = [...new Set(allRows.map((r: any) => r.user_id).filter(Boolean))];
      const habitatIds = [...new Set(allRows.map((r: any) => r.habitat_id).filter(Boolean))];

      const [profileRes2, habitatRes2] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, username').in('id', userIds)
          : Promise.resolve({ data: [] }),
        habitatIds.length > 0
          ? supabase.from('habitats').select('id, name, habitat_code').in('id', habitatIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usernameMap: Record<string, string> = {};
      ((profileRes2 as any).data ?? []).forEach((p: any) => { usernameMap[p.id] = p.username; });

      const habitatMap: Record<string, string> = {};
      ((habitatRes2 as any).data ?? []).forEach((h: any) => {
        habitatMap[h.id] = h.habitat_code ?? h.name ?? '—';
      });

      const mapContrib = (c: any): ReviewItem => ({
        id: c.id,
        type: 'contribution',
        habitatCode: c.habitats?.habitat_code ?? c.habitats?.name ?? habitatMap[c.habitat_id] ?? '—',
        submittedBy: usernameMap[c.user_id] ?? 'Unknown',
        date: new Date(c.created_at).toLocaleDateString(),
        preview: c.description ?? c.title ?? '',
        submissionType: c.type ?? 'Contribution',
        status: c.status,
      });

      const mapEdit = (e: any): ReviewItem => ({
        id: e.id,
        type: 'boundary_edit',
        habitatCode: e.habitats?.habitat_code ?? e.habitats?.name ?? habitatMap[e.habitat_id] ?? '—',
        submittedBy: usernameMap[e.user_id] ?? 'Unknown',
        date: new Date(e.created_at).toLocaleDateString(),
        preview: e.description ?? '',
        submissionType: 'Boundary Edit',
        status: e.status,
      });

      setPendingContributions((contribRes.data ?? []).map(mapContrib));
      setPendingBoundaryEdits((editRes.data ?? []).map(mapEdit));

      const allResolved = [
        ...(resolvedContribRes.data ?? []).map(mapContrib),
        ...(resolvedEditRes.data ?? []).map(mapEdit),
      ];
      setApprovedItems(allResolved.filter(i => i.status === 'approved'));
      setRejectedItems(allResolved.filter(i => i.status === 'rejected'));
      setLoading(false);
    };

    fetchAll();
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const renderCard = (item: ReviewItem) => (
    <View key={item.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{item.submissionType}</Text>
        </View>
        <Text style={styles.cardDate}>{item.date}</Text>
      </View>

      <Text style={styles.cardHabitat}>{item.habitatCode}</Text>
      <Text style={styles.cardSubmittedBy}>Submitted by {item.submittedBy}</Text>

      {item.preview ? (
        <Text style={styles.cardPreview} numberOfLines={2}>{item.preview}</Text>
      ) : null}

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => navigation.navigate('ReviewSubmission', {
            submissionId: item.id,
            type: item.type,
          })}
        >
          <Text style={styles.reviewButtonText}>Review →</Text>
        </TouchableOpacity>
      )}

      {item.status !== 'pending' && (
        <View style={[styles.statusPill, item.status === 'approved' ? styles.pillApproved : styles.pillRejected]}>
          <Text style={styles.statusPillText}>{item.status === 'approved' ? '✓ Approved' : '✗ Rejected'}</Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = (message: string) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'contributions':
        return pendingContributions.length === 0
          ? renderEmpty('No pending contributions.')
          : pendingContributions.map(renderCard);
      case 'boundary_edits':
        return pendingBoundaryEdits.length === 0
          ? renderEmpty('No pending boundary edits.')
          : pendingBoundaryEdits.map(renderCard);
      case 'observations':
        return renderEmpty('Observation flagging coming soon.');
      case 'approved':
        return approvedItems.length === 0
          ? renderEmpty('No approved submissions yet.')
          : approvedItems.map(renderCard);
      case 'rejected':
        return rejectedItems.length === 0
          ? renderEmpty('No rejected submissions yet.')
          : rejectedItems.map(renderCard);
    }
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
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Access Restricted</Text>
        <Text style={styles.deniedSubtitle}>Only verifiers and admins can view this dashboard.</Text>
      </View>
    );
  }

  const pendingCount = pendingContributions.length + pendingBoundaryEdits.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verifier Dashboard</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingBadge}>{pendingCount} pending</Text>
        )}
        <View style={styles.searchRow}>
          <GlobalSearchBar fullWidth variant="light" />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => {
          const isPending = tab.key === 'contributions'
            ? pendingContributions.length
            : tab.key === 'boundary_edits'
              ? pendingBoundaryEdits.length
              : 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}{isPending > 0 ? ` (${isPending})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a2e1a' },
  pendingBadge: {
    marginTop: 4,
    fontSize: 12,
    color: '#e65100',
    fontWeight: '700',
  },
  searchRow: {
    marginTop: 12,
    zIndex: 100,
  },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 48,
  },
  tabBarContent: { paddingHorizontal: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginRight: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4caf50',
  },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#4caf50' },
  content: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },
  cardDate: { fontSize: 12, color: '#aaa' },
  cardHabitat: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 2 },
  cardSubmittedBy: { fontSize: 13, color: '#888', marginBottom: 8 },
  cardPreview: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  reviewButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reviewButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statusPill: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillApproved: { backgroundColor: '#e8f5e9' },
  pillRejected: { backgroundColor: '#fbe9e7' },
  statusPillText: { fontSize: 13, fontWeight: '700', color: '#555' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, color: '#aaa' },
  deniedIcon: { fontSize: 48, marginBottom: 16 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
