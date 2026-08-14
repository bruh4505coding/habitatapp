import AsyncStorage from '@react-native-async-storage/async-storage';

export type MapBasemapMode = 'streets' | 'satellite';

const MAP_BASEMAP_KEY = '@myhabitat/mapBasemap';

export const MAP_BASEMAP_IDS: Record<MapBasemapMode, string> = {
  streets: 'streets-night-vector',
  /** Imagery with place labels — easier for finding habitats. */
  satellite: 'hybrid',
};

export async function getMapBasemapPreference(): Promise<MapBasemapMode> {
  const value = await AsyncStorage.getItem(MAP_BASEMAP_KEY);
  return value === 'satellite' ? 'satellite' : 'streets';
}

export async function setMapBasemapPreference(mode: MapBasemapMode): Promise<void> {
  await AsyncStorage.setItem(MAP_BASEMAP_KEY, mode);
}
