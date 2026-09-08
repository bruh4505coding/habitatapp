import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import {
  SURVEY_TYPES,
  SURVEY_TYPE_LABELS,
  SurveyType,
  SurveyVisibility,
  PRISTINENESS_LABELS,
  isSurveyType,
} from '../../lib/surveys';

type Route = RouteProp<RootStackParamList, 'EditSurvey'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EditSurveyScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { surveyId } = route.params;

  const [surveyType, setSurveyType] = useState<SurveyType>('general_habitat_check');
  const [surveyDate, setSurveyDate] = useState('');
  const [weather, setWeather] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [threats, setThreats] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<SurveyVisibility>('private');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('surveys')
        .select(`
          survey_type, survey_date, weather, habitat_condition_notes,
          threats_observed, recommendations, pristineness_rating, visibility
        `)
        .eq('id', surveyId)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSurveyType(isSurveyType(data.survey_type) ? data.survey_type : 'general_habitat_check');
      setSurveyDate(data.survey_date ?? '');
      setWeather(data.weather ?? '');
      setConditionNotes(data.habitat_condition_notes ?? '');
      setThreats(data.threats_observed ?? '');
      setRecommendations(data.recommendations ?? '');
      setRating(data.pristineness_rating ?? null);
      setVisibility(data.visibility === 'public' ? 'public' : 'private');
      setLoading(false);
    };

    load();
  }, [surveyId]);

  const handleSubmit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(surveyDate.trim())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format for the survey date.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('surveys')
      .update({
        survey_type: surveyType,
        survey_date: surveyDate.trim(),
        weather: weather.trim() || null,
        habitat_condition_notes: conditionNotes.trim() || null,
        threats_observed: threats.trim() || null,
        recommendations: recommendations.trim() || null,
        pristineness_rating: rating,
        visibility,
      })
      .eq('id', surveyId);

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not save changes', error.message);
    } else {
      Alert.alert('Survey updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Survey not found or you can't edit it.</Text>
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

      <Text style={styles.title}>Edit Survey</Text>

      <Text style={styles.label}>Survey type</Text>
      <View style={styles.chipRow}>
        {SURVEY_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, surveyType === t && styles.chipActive]}
            onPress={() => setSurveyType(t)}
          >
            <Text style={[styles.chipText, surveyType === t && styles.chipTextActive]}>
              {SURVEY_TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Survey date</Text>
      <TextInput
        style={styles.input}
        value={surveyDate}
        onChangeText={setSurveyDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#aaa"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Weather</Text>
      <TextInput
        style={styles.input}
        value={weather}
        onChangeText={setWeather}
        placeholder="e.g. Sunny, 72°F, light wind"
        placeholderTextColor="#aaa"
      />

      <Text style={styles.label}>Habitat condition rating</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, rating === null && styles.chipActive]}
          onPress={() => setRating(null)}
        >
          <Text style={[styles.chipText, rating === null && styles.chipTextActive]}>N/A</Text>
        </TouchableOpacity>
        {[1, 2, 3, 4, 5].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, rating === r && styles.chipActive]}
            onPress={() => setRating(r)}
          >
            <Text style={[styles.chipText, rating === r && styles.chipTextActive]}>
              {r} · {PRISTINENESS_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Habitat condition notes</Text>
      <TextInput
        style={styles.textArea}
        value={conditionNotes}
        onChangeText={setConditionNotes}
        placeholder="Describe the overall condition of the habitat..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Threats observed</Text>
      <TextInput
        style={styles.textArea}
        value={threats}
        onChangeText={setThreats}
        placeholder="Invasive species, erosion, human disturbance, etc."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Recommendations</Text>
      <TextInput
        style={styles.textArea}
        value={recommendations}
        onChangeText={setRecommendations}
        placeholder="Suggested follow-up actions..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[styles.visibilityOption, visibility === 'private' && styles.visibilityOptionActive]}
          onPress={() => setVisibility('private')}
        >
          <Text style={[styles.visibilityTitle, visibility === 'private' && styles.visibilityTitleActive]}>
            Private
          </Text>
          <Text style={styles.visibilityDesc}>Group members only</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.visibilityOption, visibility === 'public' && styles.visibilityOptionActive]}
          onPress={() => setVisibility('public')}
        >
          <Text style={[styles.visibilityTitle, visibility === 'public' && styles.visibilityTitleActive]}>
            Public
          </Text>
          <Text style={styles.visibilityDesc}>Shown on the habitat page</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Changes</Text>
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
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
    minHeight: 90,
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
  notFound: { fontSize: 18, fontWeight: '700', color: '#1a2e1a', marginBottom: 12, textAlign: 'center' },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
