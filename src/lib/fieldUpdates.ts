export type FieldUpdateCategory =
  | 'habitat_condition'
  | 'invasive_species'
  | 'erosion'
  | 'water'
  | 'plants'
  | 'wildlife'
  | 'safety'
  | 'restoration'
  | 'other';

export type FieldUpdateVisibility = 'public' | 'private';

export const FIELD_UPDATE_CATEGORIES: FieldUpdateCategory[] = [
  'habitat_condition',
  'invasive_species',
  'erosion',
  'water',
  'plants',
  'wildlife',
  'safety',
  'restoration',
  'other',
];

export const FIELD_UPDATE_CATEGORY_LABELS: Record<FieldUpdateCategory, string> = {
  habitat_condition: 'Habitat Condition',
  invasive_species: 'Invasive Species',
  erosion: 'Erosion',
  water: 'Water',
  plants: 'Plants',
  wildlife: 'Wildlife',
  safety: 'Safety',
  restoration: 'Restoration',
  other: 'Other',
};

export const FIELD_UPDATE_CATEGORY_COLORS: Record<FieldUpdateCategory, string> = {
  habitat_condition: '#5c6bc0',
  invasive_species: '#e53935',
  erosion: '#8d6e63',
  water: '#039be5',
  plants: '#43a047',
  wildlife: '#fb8c00',
  safety: '#d32f2f',
  restoration: '#4caf50',
  other: '#78909c',
};

export function isFieldUpdateCategory(value: string): value is FieldUpdateCategory {
  return FIELD_UPDATE_CATEGORIES.includes(value as FieldUpdateCategory);
}

export type FieldUpdate = {
  id: string;
  steward_group_id: string;
  habitat_id: string | null;
  user_id: string;
  title: string;
  body: string;
  category: FieldUpdateCategory;
  photo_url: string | null;
  visibility: FieldUpdateVisibility;
  created_at: string;
};

export type FieldUpdateRow = FieldUpdate & {
  habitats?: { name: string; habitat_code: string | null } | null;
  author?: { username: string } | null;
};

export function formatFieldUpdateDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncateBody(body: string, max = 120): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}
