import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { GeoJsonPolygon } from './kml';

const NOTIFICATIONS_LAST_SEEN_KEY = '@myhabitat/proposalNotificationsLastSeenAt';

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export type HabitatProposal = {
  id: string;
  submitted_by: string;
  name: string;
  habitat_type: string;
  habitat_labels: string[];
  steward_group_name: string;
  condition_rating: number | null;
  boundary_geojson: GeoJsonPolygon;
  kml_file_url: string | null;
  status: ProposalStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_read_at: string | null;
  created_habitat_id: string | null;
  created_at: string;
  updated_at: string;
  submitter?: { username: string } | null;
};

export type HabitatProposalInput = {
  name: string;
  habitat_labels: string[];
  steward_group_name: string;
  condition_rating: number | null;
  boundary_geojson: GeoJsonPolygon;
  kml_file_url?: string | null;
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
  pending: '#ff9800',
  approved: '#4caf50',
  rejected: '#e53935',
};

export const MAX_HABITAT_LABELS = 10;

const DECIDED_PROPOSAL_STATUSES: ProposalStatus[] = ['approved', 'rejected'];

export function formatHabitatLabels(labels: string[]): string {
  return labels.map((label) => label.trim()).filter(Boolean).join(', ');
}

export function proposalHabitatLabels(proposal: Pick<HabitatProposal, 'habitat_labels' | 'habitat_type'>): string[] {
  if (Array.isArray(proposal.habitat_labels) && proposal.habitat_labels.length > 0) {
    return proposal.habitat_labels.map((label) => label.trim()).filter(Boolean);
  }
  if (proposal.habitat_type?.trim()) return [proposal.habitat_type.trim()];
  return [];
}

export async function submitHabitatProposal(
  input: HabitatProposalInput,
  userId: string,
): Promise<{ data: HabitatProposal | null; error: string | null }> {
  const labels = input.habitat_labels.map((label) => label.trim()).filter(Boolean);
  if (labels.length === 0) {
    return { data: null, error: 'Add at least one habitat label.' };
  }
  if (labels.length > MAX_HABITAT_LABELS) {
    return { data: null, error: `You can add up to ${MAX_HABITAT_LABELS} habitat labels.` };
  }

  const { data, error } = await supabase
    .from('habitat_proposals')
    .insert({
      submitted_by: userId,
      name: input.name.trim(),
      habitat_type: formatHabitatLabels(labels),
      habitat_labels: labels,
      steward_group_name: input.steward_group_name.trim(),
      condition_rating: input.condition_rating,
      boundary_geojson: input.boundary_geojson,
      kml_file_url: input.kml_file_url ?? null,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as HabitatProposal, error: null };
}

export async function fetchMyProposals(userId: string): Promise<HabitatProposal[]> {
  const { data, error } = await supabase
    .from('habitat_proposals')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as HabitatProposal[];
}

export async function fetchUnreadDecisionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('habitat_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .in('status', DECIDED_PROPOSAL_STATUSES)
    .is('decision_read_at', null);

  if (!error) {
    return count ?? 0;
  }

  // Fallback when decision_read_at migration hasn't been run yet
  const lastSeen = await AsyncStorage.getItem(NOTIFICATIONS_LAST_SEEN_KEY);
  let query = supabase
    .from('habitat_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .in('status', DECIDED_PROPOSAL_STATUSES);

  if (lastSeen) {
    query = query.gt('reviewed_at', lastSeen);
  }

  const { count: fallbackCount, error: fallbackError } = await query;
  if (fallbackError) {
    console.warn('[notifications] unread count failed:', fallbackError.message);
    return 0;
  }
  return fallbackCount ?? 0;
}

export async function fetchProposalDecisions(userId: string): Promise<HabitatProposal[]> {
  const { data, error } = await supabase
    .from('habitat_proposals')
    .select('*')
    .eq('submitted_by', userId)
    .in('status', DECIDED_PROPOSAL_STATUSES)
    .order('reviewed_at', { ascending: false });

  if (error || !data) return [];
  return data as HabitatProposal[];
}

export async function markAllProposalDecisionsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_proposal_decisions_read');
  if (error) {
    console.warn('[notifications] mark all read failed:', error.message);
  }
  await AsyncStorage.setItem(NOTIFICATIONS_LAST_SEEN_KEY, new Date().toISOString());
}

export async function markProposalDecisionRead(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_proposal_decision_read', { p_proposal_id: proposalId });
  if (error) {
    console.warn('[notifications] mark read failed:', error.message);
  }
  await AsyncStorage.setItem(NOTIFICATIONS_LAST_SEEN_KEY, new Date().toISOString());
}

export async function fetchPendingProposals(): Promise<HabitatProposal[]> {
  const { data, error } = await supabase
    .from('habitat_proposals')
    .select(`
      *,
      submitter:profiles!submitted_by ( username )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as unknown as HabitatProposal[];
}

export async function fetchProposalById(id: string): Promise<HabitatProposal | null> {
  const { data, error } = await supabase
    .from('habitat_proposals')
    .select(`
      *,
      submitter:profiles!submitted_by ( username )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as HabitatProposal;
}

export type ModeratedProposalData = {
  name: string;
  habitat_labels: string[];
  steward_group_name: string;
  condition_rating: number | null;
};

function validateModeratedData(data: ModeratedProposalData): string | null {
  if (!data.name.trim()) return 'Habitat area name is required.';
  const labels = data.habitat_labels.map((l) => l.trim()).filter(Boolean);
  if (labels.length === 0) return 'Add at least one habitat name.';
  if (labels.length > MAX_HABITAT_LABELS) {
    return `You can add up to ${MAX_HABITAT_LABELS} habitat names.`;
  }
  if (!data.steward_group_name.trim()) return 'Steward group name is required.';
  return null;
}

function stewardGroupSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'steward-group';
  return `${base}-${Date.now().toString(36).slice(-6)}`;
}

async function findOrCreateStewardGroup(
  name: string,
  ownerId: string,
): Promise<{ groupId: string | null; error: string | null }> {
  const { data: existing } = await supabase
    .from('steward_groups')
    .select('id')
    .ilike('name', name)
    .eq('status', 'active')
    .limit(1);

  if (existing?.[0]) {
    return { groupId: existing[0].id, error: null };
  }

  const { data: created, error } = await supabase
    .from('steward_groups')
    .insert({
      slug: stewardGroupSlug(name),
      name,
      is_public: true,
      status: 'active',
      created_by: ownerId,
    })
    .select('id')
    .single();

  if (error || !created) {
    return { groupId: null, error: error?.message ?? 'Could not create steward group.' };
  }

  return { groupId: created.id, error: null };
}

/** Ensure submitter can edit habitat workspace content (lead role). */
async function ensureGroupLead(
  groupId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('group_members')
    .select('id, role, status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    if (existing.status !== 'active' || existing.role === 'member') {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'lead', status: 'active' })
        .eq('id', existing.id);
      if (error) return { error: error.message };
    }
    return { error: null };
  }

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'lead',
    status: 'active',
  });

  return { error: error?.message ?? null };
}

async function setupStewardshipForHabitat(
  habitatId: string,
  stewardGroupName: string,
  submitterId: string,
  reviewerId: string,
  conditionRating: number | null,
): Promise<{ error: string | null }> {
  const { groupId, error: groupError } = await findOrCreateStewardGroup(
    stewardGroupName,
    submitterId,
  );
  if (groupError || !groupId) {
    return { error: groupError ?? 'Could not set up steward group.' };
  }

  const { error: memberError } = await ensureGroupLead(groupId, submitterId);
  if (memberError) {
    return { error: `Could not add submitter to group: ${memberError}` };
  }

  const { error: accessError } = await supabase.from('habitat_group_access').upsert({
    group_id: groupId,
    habitat_id: habitatId,
    is_primary: true,
    status: 'active',
    relationship: 'steward',
    granted_by: reviewerId,
  }, { onConflict: 'group_id,habitat_id' });

  if (accessError) {
    return { error: accessError.message };
  }

  if (conditionRating) {
    await supabase.from('habitat_overviews').upsert({
      steward_group_id: groupId,
      habitat_id: habitatId,
      condition_rating: conditionRating,
      updated_by: reviewerId,
    }, { onConflict: 'steward_group_id,habitat_id' });
  }

  return { error: null };
}

/** Fix stewardship for a proposal that was approved before group setup ran. */
export async function repairApprovedProposalStewardship(
  proposal: HabitatProposal,
  reviewerId: string,
): Promise<{ error: string | null }> {
  if (!proposal.created_habitat_id) {
    return { error: 'This proposal has no linked habitat.' };
  }

  return setupStewardshipForHabitat(
    proposal.created_habitat_id,
    proposal.steward_group_name.trim(),
    proposal.submitted_by,
    reviewerId,
    proposal.condition_rating,
  );
}

/** Fix stewardship when you only know the habitat id (e.g. Arroyo Seco already on map). */
export async function repairStewardshipByHabitatId(
  habitatId: string,
  reviewerId: string,
): Promise<{ error: string | null }> {
  const { data: proposal, error } = await supabase
    .from('habitat_proposals')
    .select('*')
    .eq('created_habitat_id', habitatId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!proposal) {
    return { error: 'No approved proposal found for this habitat.' };
  }

  return repairApprovedProposalStewardship(proposal as HabitatProposal, reviewerId);
}

export async function fetchStewardGroupForHabitat(
  habitatId: string,
): Promise<{ id: string; name: string } | null> {
  const { data: accessRows, error } = await supabase
    .from('habitat_group_access')
    .select(`
      is_primary,
      steward_groups ( id, name, is_public, status )
    `)
    .eq('habitat_id', habitatId)
    .eq('status', 'active');

  if (error || !accessRows?.length) return null;

  const primary = accessRows.find((row: any) => row.is_primary) ?? accessRows[0];
  const sg = primary?.steward_groups as { id: string; name: string; is_public: boolean; status: string } | null;
  if (!sg?.id || !sg.is_public || sg.status !== 'active') return null;

  return { id: sg.id, name: sg.name };
}

export async function fetchRecentlyApprovedProposals(limit = 15): Promise<HabitatProposal[]> {
  const { data, error } = await supabase
    .from('habitat_proposals')
    .select(`
      *,
      submitter:profiles!submitted_by ( username )
    `)
    .eq('status', 'approved')
    .not('created_habitat_id', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as HabitatProposal[];
}

export async function approveHabitatProposal(
  proposal: HabitatProposal,
  reviewerId: string,
  moderated: ModeratedProposalData,
  reviewerNotes?: string | null,
): Promise<{ habitatId: string | null; error: string | null }> {
  const validationError = validateModeratedData(moderated);
  if (validationError) return { habitatId: null, error: validationError };

  const labels = moderated.habitat_labels.map((label) => label.trim()).filter(Boolean);
  const habitatType = formatHabitatLabels(labels);
  const areaName = moderated.name.trim();
  const stewardGroupName = moderated.steward_group_name.trim();
  const boundary = proposal.boundary_geojson;

  const { data: habitat, error: habitatError } = await supabase
    .from('habitats')
    .insert({
      name: areaName,
      habitat_code: areaName,
      habitat_type: habitatType,
      boundary,
      status: 'active',
      color: '#4caf50',
      created_by: reviewerId,
    })
    .select('id')
    .single();

  if (habitatError || !habitat) {
    return { habitatId: null, error: habitatError?.message ?? 'Could not create habitat.' };
  }

  const { error: stewardshipError } = await setupStewardshipForHabitat(
    habitat.id,
    stewardGroupName,
    proposal.submitted_by,
    reviewerId,
    moderated.condition_rating,
  );
  if (stewardshipError) {
    return { habitatId: habitat.id, error: stewardshipError };
  }

  const { error: updateError } = await supabase
    .from('habitat_proposals')
    .update({
      name: areaName,
      habitat_type: habitatType,
      habitat_labels: labels,
      steward_group_name: stewardGroupName,
      condition_rating: moderated.condition_rating,
      status: 'approved',
      reviewer_notes: reviewerNotes?.trim() || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      created_habitat_id: habitat.id,
    })
    .eq('id', proposal.id);

  if (updateError) {
    return { habitatId: habitat.id, error: updateError.message };
  }

  return { habitatId: habitat.id, error: null };
}

export async function rejectHabitatProposal(
  proposalId: string,
  reviewerId: string,
  reviewerNotes?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('habitat_proposals')
    .update({
      status: 'rejected',
      reviewer_notes: reviewerNotes?.trim() || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  return { error: error?.message ?? null };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function pickKmlFile(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.google-earth.kml+xml', 'application/xml', 'text/xml', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    name: result.assets[0].name,
  };
}

export async function uploadProposalKml(
  localUri: string,
  userId: string,
): Promise<{ path: string | null; error: string | null }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = base64ToArrayBuffer(base64);
    const path = `${userId}/${Date.now()}.kml`;

    const { error } = await supabase.storage
      .from('habitat-proposals')
      .upload(path, arrayBuffer, {
        contentType: 'application/vnd.google-earth.kml+xml',
        upsert: true,
      });

    if (error) {
      const hint = error.message.includes('Bucket not found')
        ? ' Run the habitat_proposals migration in Supabase to create the storage bucket.'
        : '';
      return { path: null, error: `${error.message}${hint}` };
    }

    return { path, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the KML file.';
    return { path: null, error: message };
  }
}
