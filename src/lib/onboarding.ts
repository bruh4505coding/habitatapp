import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_ONBOARDING_COMPLETE_KEY = '@myhabitat/onboardingComplete';

function onboardingKey(userId: string): string {
  return `@myhabitat/onboardingComplete:${userId}`;
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  if (!userId) return true;
  const value = await AsyncStorage.getItem(onboardingKey(userId));
  return value === 'true';
}

export async function setOnboardingComplete(userId: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(onboardingKey(userId), 'true');
  // Drop the old device-wide flag so it can't leak across accounts.
  await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
}

export async function resetOnboarding(userId: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.removeItem(onboardingKey(userId));
  await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
}
