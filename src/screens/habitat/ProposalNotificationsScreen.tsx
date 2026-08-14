import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import {
  fetchProposalDecisions,
  markAllProposalDecisionsRead,
  markProposalDecisionRead,
  HabitatProposal,
  PROPOSAL_STATUS_COLORS,
  formatHabitatLabels,
  proposalHabitatLabels,
} from '../../lib/habitatProposals';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProposalNotifications'>;

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

export default function ProposalNotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<HabitatProposal[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDecisions([]);
      setLoading(false);
      return;
    }

    const rows = await fetchProposalDecisions(user.id);
    setDecisions(rows);
    await markAllProposalDecisionsRead();
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const handlePress = async (proposal: HabitatProposal) => {
    await markProposalDecisionRead(proposal.id);

    if (proposal.status === 'approved' && proposal.created_habitat_id) {
      navigation.navigate('HabitatDetail', { habitatId: proposal.created_habitat_id });
      return;
    }

    navigation.navigate('SubmitHabitatProposal');
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Updates on your habitat proposals</Text>

      {loading ? (
        <ActivityIndicator color="#4caf50" style={{ marginTop: 32 }} />
      ) : decisions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No decisions yet.</Text>
          <Text style={styles.emptyHint}>
            When a moderator approves or rejects your proposal, it will show up here.
          </Text>
        </View>
      ) : (
        decisions.map((proposal) => {
          const isApproved = proposal.status === 'approved';
          return (
            <TouchableOpacity
              key={proposal.id}
              style={[
                styles.card,
                !proposal.decision_read_at && styles.cardUnread,
              ]}
              onPress={() => handlePress(proposal)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{proposal.name}</Text>
                <View style={[styles.badge, { backgroundColor: PROPOSAL_STATUS_COLORS[proposal.status] }]}>
                  <Text style={styles.badgeText}>{isApproved ? 'Approved' : 'Rejected'}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {formatHabitatLabels(proposalHabitatLabels(proposal))}
              </Text>
              <Text style={styles.cardDate}>{formatWhen(proposal.reviewed_at)}</Text>
              {proposal.reviewer_notes ? (
                <Text style={styles.cardNotes}>Moderator note: {proposal.reviewer_notes}</Text>
              ) : null}
              {isApproved && proposal.created_habitat_id ? (
                <Text style={styles.cardAction}>Tap to view habitat →</Text>
              ) : null}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#666', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardUnread: { borderColor: '#4caf50', borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#1a2e1a', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMeta: { fontSize: 13, color: '#555', marginTop: 6 },
  cardDate: { fontSize: 12, color: '#888', marginTop: 4 },
  cardNotes: { fontSize: 13, color: '#555', marginTop: 8, fontStyle: 'italic' },
  cardAction: { fontSize: 13, color: '#4caf50', fontWeight: '700', marginTop: 8 },
});
