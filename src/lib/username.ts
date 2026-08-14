import { supabase } from './supabase';

export const USERNAME_MAX_CHANGES_PER_MONTH = 2;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function validateUsernameFormat(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!username) return 'Username cannot be empty.';
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(username)) {
    return 'Username may only use letters, numbers, underscores, and hyphens.';
  }
  return null;
}

export function friendlyUsernameError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already taken') || lower.includes('duplicate') || lower.includes('unique')) {
    return 'That username is already taken. Please choose another.';
  }
  if (lower.includes('twice per month')) {
    return 'You can only change your username twice per month. Try again next month.';
  }
  if (lower.includes('3') && lower.includes('30')) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }
  if (lower.includes('letters, numbers')) {
    return 'Username may only use letters, numbers, underscores, and hyphens.';
  }
  if (lower.includes('cannot be empty')) {
    return 'Username cannot be empty.';
  }
  return message;
}

export async function isUsernameAvailable(desired: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    desired: normalizeUsername(desired),
  });
  if (error) {
    // Fallback if migration not applied yet: attempt exact lookup when readable.
    const formatError = validateUsernameFormat(desired);
    if (formatError) return false;
    const { data: row } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', normalizeUsername(desired))
      .maybeSingle();
    return !row;
  }
  return Boolean(data);
}

export async function fetchUsernameChangesRemaining(): Promise<number | null> {
  const { data, error } = await supabase.rpc('username_changes_remaining');
  if (error || typeof data !== 'number') return null;
  return data;
}

export async function assertUsernameCanBeClaimed(
  desired: string,
  options?: { requireAvailability?: boolean },
): Promise<string | null> {
  const formatError = validateUsernameFormat(desired);
  if (formatError) return formatError;

  if (options?.requireAvailability !== false) {
    const available = await isUsernameAvailable(desired);
    if (!available) {
      return 'That username is already taken. Please choose another.';
    }
  }
  return null;
}
