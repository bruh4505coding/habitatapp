import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useHabitatWorkspace } from '../../hooks/useHabitatWorkspace';
import {
  SurveyRow,
  SURVEY_TYPE_LABELS,
  SURVEY_TYPE_COLORS,
  PRISTINENESS_LABELS,
  formatSurveyDate,
} from '../../lib/surveys';

type Route = RouteProp<RootStackParamList, 'SurveyList'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SurveyListScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;
  const { hasAccess, groupId, loading: accessLoading } = useHabitatWorkspace(habitatId);

  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id, steward_group_id, habitat_id, created_by, survey_type,
        survey_date, weather, habitat_condition_notes, threats_observed,
        recommendations, pristineness_rating, visibility, created_at,
        creator:profiles!created_by ( username )
      `)
      .eq('habitat_id', habitatId)
      .order('survey_date', { ascending: false });

    if (error) {
      setSurveys([]);
    } else {
      setSurveys((data ?? []) as unknown as SurveyRow[]);
    }
    setLoading(false);
  }, [habitatId]);

  useFocusEffect(useCallback(() => {
    if (accessLoading) return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    fetchSurveys();
  }, [accessLoading, hasAccess, fetchSurveys]));

  if (accessLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedTitle}>Members only</Text>
        <Text style={styles.deniedSub}>
          Surveys are visible to members of the steward group that manages this habitat.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <Text style={styles.title}>Surveys</Text>
          {groupId ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('CreateSurvey', { habitatId, groupId })}
            >
              <Text style={styles.addButtonText}>+ New</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.subtitle}>
          Field survey records for this habitat.
        </Text>

        {surveys.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No surveys yet</Text>
            <Text style={styles.emptySub}>
              Record a survey to track this habitat's condition over time.
            </Text>
          </View>
        ) : (
          surveys.map((survey) => (
            <TouchableOpacity
              key={survey.id}
              style={styles.surveyCard}
              onPress={() => navigation.navigate('SurveyDetail', { surveyId: survey.id, habitatId })}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.typeBadge, { backgroundColor: SURVEY_TYPE_COLORS[survey.survey_type] }]}>
                  <Text style={styles.typeText}>{SURVEY_TYPE_LABELS[survey.survey_type]}</Text>
                </View>
                <Text style={styles.dateText}>{formatSurveyDate(survey.survey_date)}</Text>
              </View>
              {survey.pristineness_rating ? (
                <Text style={styles.rating}>
                  Condition: {survey.pristineness_rating}/5 · {PRISTINENESS_LABELS[survey.pristineness_rating]}
                </Text>
              ) : null}
              {survey.habitat_condition_notes ? (
                <Text style={styles.preview} numberOfLines={2}>
                  {survey.habitat_condition_notes}
                </Text>
              ) : null}
              <Text style={styles.meta}>By {survey.creator?.username ?? 'Unknown'}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a' },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 16 },
  addButton: {
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  surveyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  dateText: { fontSize: 12, color: '#888' },
  rating: { fontSize: 13, fontWeight: '700', color: '#1a2e1a', marginBottom: 4 },
  preview: { fontSize: 14, color: '#555', lineHeight: 20 },
  meta: { fontSize: 12, color: '#888', marginTop: 6 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
