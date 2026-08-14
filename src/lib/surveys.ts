export type SurveyType =
  | 'general_habitat_check'
  | 'invasive_species_survey'
  | 'post_fire_recovery'
  | 'water_seep_check'
  | 'erosion_survey'
  | 'rare_plant_survey'
  | 'pollinator_survey'
  | 'restoration_monitoring';

export const SURVEY_TYPES: SurveyType[] = [
  'general_habitat_check',
  'invasive_species_survey',
  'post_fire_recovery',
  'water_seep_check',
  'erosion_survey',
  'rare_plant_survey',
  'pollinator_survey',
  'restoration_monitoring',
];

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  general_habitat_check: 'General Habitat Check',
  invasive_species_survey: 'Invasive Species Survey',
  post_fire_recovery: 'Post-Fire Recovery',
  water_seep_check: 'Water / Seep Check',
  erosion_survey: 'Erosion Survey',
  rare_plant_survey: 'Rare Plant Survey',
  pollinator_survey: 'Pollinator Survey',
  restoration_monitoring: 'Restoration Monitoring',
};

export const SURVEY_TYPE_COLORS: Record<SurveyType, string> = {
  general_habitat_check: '#5c6bc0',
  invasive_species_survey: '#e53935',
  post_fire_recovery: '#ef6c00',
  water_seep_check: '#039be5',
  erosion_survey: '#8d6e63',
  rare_plant_survey: '#43a047',
  pollinator_survey: '#fb8c00',
  restoration_monitoring: '#4caf50',
};

export function isSurveyType(value: string): value is SurveyType {
  return SURVEY_TYPES.includes(value as SurveyType);
}

export type SurveyVisibility = 'public' | 'private';

export const PRISTINENESS_LABELS: Record<number, string> = {
  1: 'Highly degraded',
  2: 'Degraded',
  3: 'Moderate',
  4: 'Good',
  5: 'Pristine',
};

export type Survey = {
  id: string;
  steward_group_id: string;
  habitat_id: string;
  created_by: string;
  survey_type: SurveyType;
  survey_date: string;
  weather: string | null;
  habitat_condition_notes: string | null;
  threats_observed: string | null;
  recommendations: string | null;
  pristineness_rating: number | null;
  visibility: SurveyVisibility;
  created_at: string;
};

export type SurveyRow = Survey & {
  creator?: { username: string } | null;
};

export function isSurveyUpcoming(surveyDate: string, todayISO: string): boolean {
  return surveyDate > todayISO;
}

export function formatSurveyDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${month}/${day}/${year}`;
}
