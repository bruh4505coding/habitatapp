import {
  Linking, Platform,
} from 'react-native';
import { Alert } from '../lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export type MapCenter = {
  latitude: number;
  longitude: number;
};

/** How the world map should open. */
export type MapLocationMode = 'off' | 'device' | 'custom';

export type MapLocationSettings = {
  mode: MapLocationMode;
  customCenter: MapCenter | null;
};

export type LocationPermissionState = 'undetermined' | 'granted' | 'denied';

const MAP_CENTER_PREF_KEY = '@myhabitat/mapCenterOnUser';
const MAP_BANNER_DISMISSED_KEY = '@myhabitat/mapLocationBannerDismissed';
const MAP_LOCATION_MODE_KEY = '@myhabitat/mapLocationMode';
const MAP_CUSTOM_CENTER_KEY = '@myhabitat/mapCustomCenter';
const POSITION_TIMEOUT_MS = 12000;

/**
 * Legacy boolean preference (kept for migration):
 * - null  = never asked
 * - true  = device location on
 * - false = off / declined
 */
export async function getMapCenterPreference(): Promise<boolean | null> {
  const value = await AsyncStorage.getItem(MAP_CENTER_PREF_KEY);
  if (value === null) return null;
  return value === 'true';
}

export async function setMapCenterPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(MAP_CENTER_PREF_KEY, enabled ? 'true' : 'false');
  await AsyncStorage.setItem(MAP_LOCATION_MODE_KEY, enabled ? 'device' : 'off');
}

export async function getLocationBannerDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(MAP_BANNER_DISMISSED_KEY);
  return value === 'true';
}

export async function setLocationBannerDismissed(dismissed: boolean): Promise<void> {
  await AsyncStorage.setItem(MAP_BANNER_DISMISSED_KEY, dismissed ? 'true' : 'false');
}

export async function getMapLocationSettings(): Promise<MapLocationSettings> {
  const [modeRaw, customRaw, legacy] = await Promise.all([
    AsyncStorage.getItem(MAP_LOCATION_MODE_KEY),
    AsyncStorage.getItem(MAP_CUSTOM_CENTER_KEY),
    getMapCenterPreference(),
  ]);

  let mode: MapLocationMode;
  if (modeRaw === 'off' || modeRaw === 'device' || modeRaw === 'custom') {
    mode = modeRaw;
  } else if (legacy === true) {
    mode = 'device';
  } else if (legacy === false) {
    mode = 'off';
  } else {
    mode = 'off';
  }

  let customCenter: MapCenter | null = null;
  if (customRaw) {
    try {
      const parsed = JSON.parse(customRaw) as MapCenter;
      if (
        typeof parsed?.latitude === 'number'
        && typeof parsed?.longitude === 'number'
      ) {
        customCenter = parsed;
      }
    } catch {
      customCenter = null;
    }
  }

  if (mode === 'custom' && !customCenter) {
    mode = 'off';
    await AsyncStorage.multiSet([
      [MAP_LOCATION_MODE_KEY, 'off'],
      [MAP_CENTER_PREF_KEY, 'false'],
    ]);
  }

  return { mode, customCenter };
}

/** True only when map centering is actually active. */
export function isMapLocationCenteringOn(settings: MapLocationSettings): boolean {
  if (settings.mode === 'device') return true;
  if (settings.mode === 'custom' && settings.customCenter) return true;
  return false;
}

export async function setMapLocationMode(mode: MapLocationMode): Promise<void> {
  const pref = mode === 'off' ? 'false' : 'true';
  await AsyncStorage.multiSet([
    [MAP_LOCATION_MODE_KEY, mode],
    [MAP_CENTER_PREF_KEY, pref],
  ]);
}

export async function disableMapLocation(): Promise<void> {
  await AsyncStorage.multiSet([
    [MAP_LOCATION_MODE_KEY, 'off'],
    [MAP_CENTER_PREF_KEY, 'false'],
    [MAP_BANNER_DISMISSED_KEY, 'false'],
  ]);
}

export async function setCustomMapCenter(center: MapCenter): Promise<void> {
  await AsyncStorage.setItem(MAP_CUSTOM_CENTER_KEY, JSON.stringify(center));
  await setMapLocationMode('custom');
  await setLocationBannerDismissed(true);
}

export async function enableDeviceMapLocation(): Promise<void> {
  await setMapLocationMode('device');
  await setLocationBannerDismissed(true);
}

/** Clears stored map-location prefs so the first-open ask flow can be tested again. */
export async function resetMapLocationPreferences(): Promise<void> {
  await AsyncStorage.multiRemove([
    MAP_CENTER_PREF_KEY,
    MAP_BANNER_DISMISSED_KEY,
    MAP_LOCATION_MODE_KEY,
    MAP_CUSTOM_CENTER_KEY,
  ]);
}

/**
 * Resolve the map center for open:
 * - device → GPS (ask once if never decided)
 * - custom → saved area
 * - off → null (show Enable location)
 */
export async function ensureMapLocationOnOpen(): Promise<{
  center: MapCenter | null;
  mode: MapLocationMode;
}> {
  const settings = await getMapLocationSettings();
  const permission = await getLocationPermissionState();
  const legacyPref = await getMapCenterPreference();

  // First visit (never chose): ask / use device location once.
  if (legacyPref === null && settings.mode === 'off') {
    if (permission === 'undetermined' || permission === 'granted') {
      const location = permission === 'granted'
        ? await getMapLocationIfPermitted()
        : await requestMapLocationQuiet();
      if (location) {
        await enableDeviceMapLocation();
        return { center: location, mode: 'device' };
      }
      if (permission === 'undetermined') {
        await disableMapLocation();
      }
      return { center: null, mode: 'off' };
    }
  }

  if (settings.mode === 'custom' && settings.customCenter) {
    return { center: settings.customCenter, mode: 'custom' };
  }

  if (settings.mode === 'device') {
    const location = await getMapLocationIfPermitted();
    if (location) {
      await setLocationBannerDismissed(true);
      return { center: location, mode: 'device' };
    }
    return { center: null, mode: 'device' };
  }

  return { center: null, mode: 'off' };
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

function showLocationSettingsAlert(): void {
  // Browsers have no app settings screen to open — Linking.openSettings() is a
  // no-op there, so point at the site permission control instead.
  if (Platform.OS === 'web') {
    Alert.alert(
      'Location is blocked for this site',
      'Your browser is blocking location for myHabitat. Click the lock (or location) icon in the address bar, allow Location, then reload and tap Enable location again.',
    );
    return;
  }

  Alert.alert(
    'Turn on location for Near me',
    'Location was turned off for this app. Open Settings, enable Location → While Using the App, then come back and tap Enable location.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
}

function coordsFrom(position: Location.LocationObject): MapCenter {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location request timed out')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readPosition(): Promise<MapCenter | null> {
  // hasServicesEnabledAsync reports the OS location toggle; on web the browser
  // geolocation API is the only gate, so skip the check there.
  if (Platform.OS !== 'web') {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      Alert.alert(
        'Location Services are off',
        'Turn on Location Services in your device Settings, then try again.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      POSITION_TIMEOUT_MS,
    );
    return coordsFrom(position);
  } catch {
    // The last-known cache is a native-only convenience; on web this call can
    // itself throw, which would escape as an unhandled rejection.
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 1000 * 60 * 30,
        requiredAccuracy: 2000,
      });
      if (lastKnown) {
        return coordsFrom(lastKnown);
      }
    } catch {
      return null;
    }
    return null;
  }
}

/** Read location only if permission was already granted — no system prompt. */
export async function getMapLocationIfPermitted(): Promise<MapCenter | null> {
  const state = await getLocationPermissionState();
  if (state !== 'granted') return null;

  try {
    return await readPosition();
  } catch {
    return null;
  }
}

/**
 * Request permission if needed, then read location.
 * Safe to call after a prior decline — re-prompts when possible, or opens Settings.
 */
export async function requestMapLocation(): Promise<MapCenter | null> {
  const location = await requestMapLocationQuiet();
  if (location) return location;

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    showLocationSettingsAlert();
    return null;
  }

  Alert.alert(
    'Could not get your location',
    Platform.OS === 'web'
      ? 'Your browser allowed location but did not return a position. Check that location is on for your device and try again.'
      : 'Make sure Location Services are on and try again. If you\'re on a simulator, set a simulated location under Features → Location.',
  );
  return null;
}

/** Same as requestMapLocation but without error alerts (used for first-open prompt). */
export async function requestMapLocationQuiet(): Promise<MapCenter | null> {
  let permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Location.enableNetworkProviderAsync();
    }
    return await readPosition();
  } catch {
    return null;
  }
}

export function formatMapLocationStatus(settings: MapLocationSettings): string {
  if (!isMapLocationCenteringOn(settings)) return 'Off';
  if (settings.mode === 'device') return 'Your device location';
  if (settings.mode === 'custom' && settings.customCenter) {
    const { latitude, longitude } = settings.customCenter;
    return `Custom area (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
  }
  return 'Off';
}
