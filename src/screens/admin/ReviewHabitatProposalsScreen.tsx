import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { canManageUsers, normalizeUserRole } from '../../lib/roles';
import {
  fetchPendingProposals,
  fetchRecentlyApprovedProposals,
  repairApprovedProposalStewardship,
  HabitatProposal,
  formatHabitatLabels,
  proposalHabitatLabels,
} from '../../lib/habitatProposals';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ReviewHabitatProposals'>;

export default function ReviewHabitatProposalsScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [proposals, setProposals] = useState<HabitatProposal[]>([]);
  const [recentApproved, setRecentApproved] = useState<HabitatProposal[]>([]);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  const load = useCallback(async () => {
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

    const pending = await fetchPendingProposals();
    const approved = await fetchRecentlyApprovedProposals();
    setProposals(pending);
    setRecentApproved(approved);
    setLoading(false);
  }, []);

  const handleRepair = async (proposal: HabitatProposal) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setRepairingId(proposal.id);
    const { error } = await repairApprovedProposalStewardship(proposal, user.id);
    setRepairingId(null);

    if (error) {
      Alert.alert('Repair failed', error);
    } else {
      Alert.alert('Fixed', `Steward group and editor access set up for "${proposal.name}".`);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

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

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Habitat Proposals</Text>
      <Text style={styles.subtitle}>
        Review KML boundary submissions and approve them to create habitats on the map.
      </Text>

      {proposals.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No pending proposals.</Text>
        </View>
      ) : (
        proposals.map((proposal) => (
          <TouchableOpacity
            key={proposal.id}
            style={styles.card}
            onPress={() => navigation.navigate('ReviewHabitatProposalDetail', { proposalId: proposal.id })}
          >
            <Text style={styles.cardTitle}>{proposal.name}</Text>
            <Text style={styles.cardMeta}>
              {formatHabitatLabels(proposalHabitatLabels(proposal))} · {proposal.steward_group_name}
            </Text>
            <Text style={styles.cardSubmitter}>
              Submitted by {proposal.submitter?.username ?? 'Unknown'}
            </Text>
            <Text style={styles.cardDate}>
              {new Date(proposal.created_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))
      )}

      {recentApproved.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recently approved</Text>
          <Text style={styles.sectionHint}>
            Tap Fix access if the steward group or submitter editor role was not set up.
          </Text>
          {recentApproved.map((proposal) => (
            <View key={proposal.id} style={styles.card}>
              <Text style={styles.cardTitle}>{proposal.name}</Text>
              <Text style={styles.cardMeta}>{proposal.steward_group_name}</Text>
              <TouchableOpacity
                style={styles.repairButton}
                onPress={() => handleRepair(proposal)}
                disabled={repairingId === proposal.id}
              >
                {repairingId === proposal.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.repairButtonText}>Fix access</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyText: { fontSize: 15, color: '#888' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#1a2e1a' },
  cardMeta: { fontSize: 14, color: '#555', marginTop: 6 },
  cardSubmitter: { fontSize: 13, color: '#777', marginTop: 4 },
  cardDate: { fontSize: 12, color: '#999', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a2e1a', marginTop: 24, marginBottom: 4 },
  sectionHint: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  repairButton: {
    marginTop: 12,
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  repairButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  denied: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', textAlign: 'center', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
