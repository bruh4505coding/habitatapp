import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { isGroupLeadOrManager } from '../../lib/groupRoles';
import {
  SurveyRow,
  SURVEY_TYPE_LABELS,
  SURVEY_TYPE_COLORS,
  PRISTINENESS_LABELS,
  formatSurveyDate,
} from '../../lib/surveys';

type Route = RouteProp<RootStackParamList, 'SurveyDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SurveyDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { surveyId } = route.params;

  const [survey, setSurvey] = useState<SurveyRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { memberRole } = useGroupMembership(survey?.steward_group_id);

  const fetchSurvey = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id, steward_group_id, habitat_id, created_by, survey_type,
        survey_date, weather, habitat_condition_notes, threats_observed,
        recommendations, pristineness_rating, visibility, created_at,
        creator:profiles!created_by ( username )
      `)
      .eq('id', surveyId)
      .single();

    if (error || !data) {
      setSurvey(null);
    } else {
      setSurvey(data as unknown as SurveyRow);
    }
    setLoading(false);
  }, [surveyId]);

  useFocusEffect(useCallback(() => {
    fetchSurvey();
  }, [fetchSurvey]));

  const handleDelete = () => {
    Alert.alert(
      'Delete survey',
      'This cannot be undone. Delete this survey record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase
              .from('surveys')
              .delete()
              .eq('id', surveyId);
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

  if (!survey) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Survey not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canManage = (currentUserId != null && survey.created_by === currentUserId)
    || isGroupLeadOrManager(memberRole);

  const renderField = (label: string, value: string | null) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.bodyText}>{value?.trim() || 'Not recorded.'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.typeBadge, { backgroundColor: SURVEY_TYPE_COLORS[survey.survey_type] }]}>
        <Text style={styles.typeText}>{SURVEY_TYPE_LABELS[survey.survey_type]}</Text>
      </View>

      <Text style={styles.date}>{formatSurveyDate(survey.survey_date)}</Text>
      <Text style={styles.byline}>Surveyed by {survey.creator?.username ?? 'Unknown'}</Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Weather</Text>
          <Text style={styles.infoValue}>{survey.weather?.trim() || '—'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Condition</Text>
          <Text style={styles.infoValue}>
            {survey.pristineness_rating
              ? `${survey.pristineness_rating}/5 · ${PRISTINENESS_LABELS[survey.pristineness_rating]}`
              : '—'}
          </Text>
        </View>
      </View>

      {renderField('Habitat Condition Notes', survey.habitat_condition_notes)}
      {renderField('Threats Observed', survey.threats_observed)}
      {renderField('Recommendations', survey.recommendations)}

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Visibility</Text>
          <Text style={styles.infoValue}>{survey.visibility === 'public' ? 'Public' : 'Private'}</Text>
        </View>
      </View>

      {canManage ? (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditSurvey', { surveyId: survey.id, habitatId: survey.habitat_id })}
        >
          <Text style={styles.editText}>Edit Survey</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.habitatLink}
        onPress={() => navigation.navigate('HabitatDetail', { habitatId: survey.habitat_id })}
      >
        <Text style={styles.habitatLinkText}>View habitat →</Text>
      </TouchableOpacity>

      {canManage ? (
        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.deleteDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>Delete Survey</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
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
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  typeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  date: { fontSize: 24, fontWeight: '800', color: '#1a2e1a', marginTop: 12 },
  byline: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 20 },
  infoGrid: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a2e1a', flexShrink: 1, textAlign: 'right' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  bodyText: { fontSize: 15, color: '#444', lineHeight: 22 },
  editButton: {
    backgroundColor: '#1a2e1a',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  editText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  habitatLink: { marginTop: 16, alignItems: 'center' },
  habitatLinkText: { fontSize: 14, color: '#4caf50', fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#c62828',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteDisabled: { opacity: 0.6 },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notFound: { fontSize: 18, fontWeight: '700', color: '#1a2e1a', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
