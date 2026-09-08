import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GroupMembersOnlyGate from '../../components/steward/GroupMembersOnlyGate';
import FieldUpdateCard from '../../components/steward/FieldUpdateCard';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { GroupMemberRole, isGroupLeadOrManager } from '../../lib/groupRoles';
import { FieldUpdateRow, FieldUpdateVisibility } from '../../lib/fieldUpdates';

type Route = RouteProp<RootStackParamList, 'FieldUpdateDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function canManageUpdate(
  update: FieldUpdateRow,
  userId: string | null,
  memberRole: GroupMemberRole | null,
): boolean {
  if (!userId) return false;
  if (update.user_id === userId) return true;
  return isGroupLeadOrManager(memberRole);
}

function FieldUpdateDetailContent() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId, updateId } = route.params;
  const { memberRole } = useGroupMembership(groupId);

  const [update, setUpdate] = useState<FieldUpdateRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUpdate = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from('field_updates')
      .select(`
        id, steward_group_id, habitat_id, user_id, title, body,
        category, photo_url, visibility, created_at,
        habitats ( name, habitat_code ),
        author:profiles!user_id ( username )
      `)
      .eq('id', updateId)
      .eq('steward_group_id', groupId)
      .single();

    if (error || !data) {
      setUpdate(null);
    } else {
      setUpdate(data as unknown as FieldUpdateRow);
    }
    setLoading(false);
  }, [groupId, updateId]);

  useFocusEffect(useCallback(() => {
    fetchUpdate();
  }, [fetchUpdate]));

  const handleVisibilityChange = async (newVisibility: FieldUpdateVisibility) => {
    if (!update || update.visibility === newVisibility) return;

    setUpdatingVisibility(true);

    const { error } = await supabase
      .from('field_updates')
      .update({ visibility: newVisibility })
      .eq('id', updateId)
      .eq('steward_group_id', groupId);

    setUpdatingVisibility(false);

    if (error) {
      Alert.alert('Update failed', error.message);
    } else {
      setUpdate({ ...update, visibility: newVisibility });
      Alert.alert(
        'Visibility updated',
        newVisibility === 'public'
          ? 'This update is now visible on the public group page.'
          : 'This update is now private to group members only.',
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete field update',
      'This cannot be undone. Are you sure you want to delete this update?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);

            const { error } = await supabase
              .from('field_updates')
              .delete()
              .eq('id', updateId)
              .eq('steward_group_id', groupId);

            setDeleting(false);

            if (error) {
              Alert.alert('Delete failed', error.message);
            } else {
              navigation.goBack();
            }
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

  if (!update) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Field update not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canManage = canManageUpdate(update, currentUserId, memberRole);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <FieldUpdateCard update={update} />

      {canManage ? (
        <>
          <Text style={styles.sectionLabel}>Visibility</Text>
          {updatingVisibility ? (
            <ActivityIndicator color="#4caf50" style={styles.actionLoader} />
          ) : (
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  update.visibility === 'private' && styles.visibilityOptionActive,
                ]}
                onPress={() => handleVisibilityChange('private')}
              >
                <Text style={[
                  styles.visibilityTitle,
                  update.visibility === 'private' && styles.visibilityTitleActive,
                ]}>
                  Private
                </Text>
                <Text style={styles.visibilityDesc}>Group members only</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  update.visibility === 'public' && styles.visibilityOptionActive,
                ]}
                onPress={() => handleVisibilityChange('public')}
              >
                <Text style={[
                  styles.visibilityTitle,
                  update.visibility === 'public' && styles.visibilityTitleActive,
                ]}>
                  Public
                </Text>
                <Text style={styles.visibilityDesc}>Shown on group page</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteDisabled]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteText}>Delete Field Update</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {update.habitat_id ? (
        <TouchableOpacity
          style={styles.habitatLink}
          onPress={() => navigation.navigate('HabitatDetail', { habitatId: update.habitat_id! })}
        >
          <Text style={styles.habitatLinkText}>View linked habitat →</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

export default function FieldUpdateDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;

  return (
    <GroupMembersOnlyGate groupId={groupId} navigation={navigation}>
      <FieldUpdateDetailContent />
    </GroupMembersOnlyGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f0f4f0',
  },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  visibilityRow: { flexDirection: 'row', gap: 10 },
  visibilityOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  visibilityOptionActive: { borderColor: '#4caf50', backgroundColor: '#f1f8f1' },
  visibilityTitle: { fontSize: 15, fontWeight: '700', color: '#666', marginBottom: 4 },
  visibilityTitleActive: { color: '#1a2e1a' },
  visibilityDesc: { fontSize: 12, color: '#888', lineHeight: 16 },
  actionLoader: { marginVertical: 12 },
  deleteButton: {
    backgroundColor: '#c62828',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteDisabled: { opacity: 0.6 },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  habitatLink: { marginTop: 24, alignItems: 'center' },
  habitatLinkText: { fontSize: 14, color: '#4caf50', fontWeight: '600' },
  notFound: { fontSize: 18, fontWeight: '700', color: '#1a2e1a', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
