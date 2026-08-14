import { supabase } from './supabase';
import { resetOnboarding } from './onboarding';
import { setTourStep } from './onboardingTour';

/**
 * Re-authenticates with the current user's email + password, then permanently
 * deletes their auth account (profile cascades via FK).
 */
export async function deleteOwnAccount(password: string): Promise<{ error: string | null }> {
  const trimmed = password.trim();
  if (!trimmed) {
    return { error: 'Enter your password to delete your account.' };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return { error: userError?.message ?? 'You must be signed in to delete your account.' };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: trimmed,
  });
  if (reauthError) {
    return { error: 'Incorrect password. Account was not deleted.' };
  }

  const userId = user.id;
  const { error: deleteError } = await supabase.rpc('delete_own_account');
  if (deleteError) {
    return { error: deleteError.message };
  }

  await resetOnboarding(userId);
  setTourStep(null);

  // Auth user is gone — clear local session without a server round-trip.
  await supabase.auth.signOut({ scope: 'local' });

  return { error: null };
}
