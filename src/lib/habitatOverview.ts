import { supabase } from './supabase';
import {
  HabitatPaletteKey,
  isHabitatPaletteKey,
} from './habitatTheme';

export type ManagementType =
  | 'national_park'
  | 'protected'
  | 'park'
  | 'federal_land'
  | 'other';

export const MANAGEMENT_TYPES: ManagementType[] = [
  'national_park',
  'protected',
  'park',
  'federal_land',
  'other',
];

export const MANAGEMENT_TYPE_LABELS: Record<ManagementType, string> = {
  national_park: 'National Park',
  protected: 'Protected',
  park: 'Park',
  federal_land: 'Federal Land',
  other: 'Other',
};

export function isManagementType(value: string | null | undefined): value is ManagementType {
  return MANAGEMENT_TYPES.includes(value as ManagementType);
}

export type LearnLink = {
  title: string;
  url: string;
};

export type OverviewEvent = {
  title: string;
  description: string;
};

export const MAX_LEARN_LINKS = 12;
export const MAX_OVERVIEW_EVENTS = 12;
export const MAX_CHARACTERISTIC_SPECIES = 40;
export const LEARN_LINKS_PREVIEW = 3;
export const EVENTS_PREVIEW = 3;

export function parseSpeciesList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, MAX_CHARACTERISTIC_SPECIES);
}

export function parseLearnLinks(raw: unknown): LearnLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      if (!title || !url) return null;
      return { title, url };
    })
    .filter((item): item is LearnLink => item !== null)
    .slice(0, MAX_LEARN_LINKS);
}

export function parseOverviewEvents(raw: unknown): OverviewEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const description = typeof row.description === 'string' ? row.description.trim() : '';
      if (!title) return null;
      return { title, description };
    })
    .filter((item): item is OverviewEvent => item !== null)
    .slice(0, MAX_OVERVIEW_EVENTS);
}

export type HabitatOverview = {
  id: string;
  steward_group_id: string;
  habitat_id: string;
  condition_rating: number | null;
  management_type: ManagementType | null;
  management_custom: string | null;
  feature_image_url: string | null;
  banner_image_url: string | null;
  palette_key: HabitatPaletteKey;
  learn_links: LearnLink[];
  events: OverviewEvent[];
  characteristic_flora: string[];
  characteristic_fauna: string[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function formatManagementLabel(
  type: ManagementType | null | undefined,
  custom: string | null | undefined,
): string | null {
  if (!type) return null;
  if (type === 'other') {
    return custom?.trim() || 'Other';
  }
  return MANAGEMENT_TYPE_LABELS[type];
}

export function conditionTierLabel(rating: number): string {
  if (rating >= 4) return 'Intact';
  if (rating >= 3) return 'Moderate';
  return 'Degraded';
}

export function formatLastSurveyDate(dateStr: string | null): string {
  if (!dateStr) return 'no surveys yet';
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.pdf($|\?)/i.test(url);
}

export async function fetchHabitatOverview(
  groupId: string,
  habitatId: string,
): Promise<HabitatOverview | null> {
  const { data, error } = await supabase
    .from('habitat_overviews')
    .select('*')
    .eq('steward_group_id', groupId)
    .eq('habitat_id', habitatId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeOverviewRow(data as Record<string, unknown>);
}

function normalizeOverviewRow(data: Record<string, unknown>): HabitatOverview {
  return {
    ...(data as Omit<
      HabitatOverview,
      'learn_links' | 'events' | 'characteristic_flora' | 'characteristic_fauna'
    >),
    learn_links: parseLearnLinks(data.learn_links),
    events: parseOverviewEvents(data.events),
    characteristic_flora: parseSpeciesList(data.characteristic_flora),
    characteristic_fauna: parseSpeciesList(data.characteristic_fauna),
    banner_image_url: typeof data.banner_image_url === 'string'
      ? data.banner_image_url
      : null,
    palette_key: isHabitatPaletteKey(data.palette_key)
      ? data.palette_key
      : 'forest',
  };
}

export type HabitatOverviewInput = {
  steward_group_id: string;
  habitat_id: string;
  condition_rating?: number | null;
  management_type?: ManagementType | null;
  management_custom?: string | null;
  feature_image_url?: string | null;
  banner_image_url?: string | null;
  palette_key?: HabitatPaletteKey;
  learn_links?: LearnLink[];
  events?: OverviewEvent[];
  characteristic_flora?: string[];
  characteristic_fauna?: string[];
  updated_by: string;
};

export async function upsertHabitatOverview(
  input: HabitatOverviewInput,
): Promise<{ data: HabitatOverview | null; error: string | null }> {
  const payload: Record<string, unknown> = {
    steward_group_id: input.steward_group_id,
    habitat_id: input.habitat_id,
    updated_by: input.updated_by,
  };

  if (input.condition_rating !== undefined) payload.condition_rating = input.condition_rating;
  if (input.management_type !== undefined) payload.management_type = input.management_type;
  if (input.management_custom !== undefined) payload.management_custom = input.management_custom;
  if (input.feature_image_url !== undefined) payload.feature_image_url = input.feature_image_url;
  if (input.banner_image_url !== undefined) payload.banner_image_url = input.banner_image_url;
  if (input.palette_key !== undefined) payload.palette_key = input.palette_key;
  if (input.learn_links !== undefined) payload.learn_links = input.learn_links;
  if (input.events !== undefined) payload.events = input.events;
  if (input.characteristic_flora !== undefined) {
    payload.characteristic_flora = input.characteristic_flora.slice(0, MAX_CHARACTERISTIC_SPECIES);
  }
  if (input.characteristic_fauna !== undefined) {
    payload.characteristic_fauna = input.characteristic_fauna.slice(0, MAX_CHARACTERISTIC_SPECIES);
  }

  const { data, error } = await supabase
    .from('habitat_overviews')
    .upsert(payload, { onConflict: 'steward_group_id,habitat_id' })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return {
    data: normalizeOverviewRow(data as Record<string, unknown>),
    error: null,
  };
}

export async function upsertOverviewLearnEvents(
  groupId: string,
  habitatId: string,
  learnLinks: LearnLink[],
  events: OverviewEvent[],
  updatedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await upsertHabitatOverview({
    steward_group_id: groupId,
    habitat_id: habitatId,
    learn_links: learnLinks.slice(0, MAX_LEARN_LINKS),
    events: events.slice(0, MAX_OVERVIEW_EVENTS),
    updated_by: updatedBy,
  });
  return { error };
}

export async function upsertOverviewSpecies(
  groupId: string,
  habitatId: string,
  flora: string[],
  fauna: string[],
  updatedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await upsertHabitatOverview({
    steward_group_id: groupId,
    habitat_id: habitatId,
    characteristic_flora: parseSpeciesList(flora),
    characteristic_fauna: parseSpeciesList(fauna),
    updated_by: updatedBy,
  });
  return { error };
}
