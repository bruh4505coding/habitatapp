import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity,
  StyleSheet, Text, ActivityIndicator, AppState,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import ArcGISMapWebView from './ArcGISMapWebView';
import GlobalSearchBar from '../../components/GlobalSearchBar';
import NotificationBellButton from '../../components/NotificationBellButton';
import CoachMarkOverlay, { SpotRect } from '../../components/onboarding/CoachMarkOverlay';
import {
  requestMapLocation,
  ensureMapLocationOnOpen,
  enableDeviceMapLocation,
  disableMapLocation,
  getMapLocationSettings,
  getMapLocationIfPermitted,
  setLocationBannerDismissed as persistLocationBannerDismissed,
  MapCenter,
  MapLocationMode,
} from '../../lib/userLocation';
import {
  getMapBasemapPreference,
  setMapBasemapPreference,
  MapBasemapMode,
} from '../../lib/mapBasemap';
import { fetchUnreadDecisionCount } from '../../lib/habitatProposals';
import {
  isOnboardingComplete,
  setOnboardingComplete,
} from '../../lib/onboarding';
import {
  ONBOARDING_DEMO_HABITAT,
  ONBOARDING_DEMO_HABITAT_ID,
} from '../../lib/onboardingMockHabitat';
import {
  TourStep,
  TOUR_COPY,
  advanceTour,
  canRetreatTour,
  getTourStep,
  isMapChromeTourStep,
  retreatTour,
  setTourStep,
  startTour,
  subscribeTourStep,
} from '../../lib/onboardingTour';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type Habitat = {
  id: string;
  name: string;
  boundary: any;
  habitat_code: string | null;
  habitat_type: string | null;
  region: string | null;
  color: string | null;
};

function measureRef(ref: React.RefObject<View | null>): Promise<SpotRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node || typeof (node as any).measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    (node as any).measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/** Stable key for location prefs — excludes live GPS so refocus does not re-center. */
function locationSettingsKey(mode: MapLocationMode, customCenter: MapCenter | null): string {
  if (mode === 'custom' && customCenter) {
    return `custom:${customCenter.latitude},${customCenter.longitude}`;
  }
  return mode;
}

export default function WorldMapScreen() {
  const navigation = useNavigation<Nav>();
  const [habitats, setHabitats] = useState<Habitat[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState('?');
  const [userLocation, setUserLocation] = useState<MapCenter | null>(null);
  const [locationMode, setLocationMode] = useState<MapLocationMode>('off');
  const [mapCenterMode, setMapCenterMode] = useState<'default' | 'user' | 'polygons'>('default');
  const [centerNonce, setCenterNonce] = useState(0);
  const [centeringLocation, setCenteringLocation] = useState(false);
  const [basemapMode, setBasemapMode] = useState<MapBasemapMode>('streets');
  const [unreadCount, setUnreadCount] = useState(0);
  // ✕ hides for this visit; remounting the map screen can show it again if still off.
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);
  const clearedLegacyBannerDismiss = useRef(false);
  /** Avoid reloading / re-centering the map every time we return from HabitatDetail. */
  const mapHydratedRef = useRef(false);
  const appliedLocationKeyRef = useRef<string | null>(null);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStepState] = useState<TourStep | null>(getTourStep());
  const [spotTarget, setSpotTarget] = useState<SpotRect | null>(null);
  const tourCompletingRef = useRef(false);

  const settingsRef = useRef<View>(null);
  const bellRef = useRef<View>(null);
  const proposeRef = useRef<View>(null);

  const locationEnabled = (locationMode === 'device' || locationMode === 'custom')
    && mapCenterMode === 'user'
    && userLocation !== null;
  const showEnableBanner = !loading && !tourActive && !locationEnabled && !locationBannerDismissed;

  const refreshUnreadCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUnreadCount(await fetchUnreadDecisionCount(user.id));
    } else {
      setUnreadCount(0);
    }
  }, []);

  const applyMapCenter = useCallback((location: MapCenter, mode: MapLocationMode) => {
    setUserLocation(location);
    setLocationMode(mode);
    setMapCenterMode('user');
    setCenterNonce((n) => n + 1);
    appliedLocationKeyRef.current = locationSettingsKey(
      mode,
      mode === 'custom' ? location : null,
    );
  }, []);

  const loadLiveMap = useCallback(async () => {
    setTourActive(false);
    setSpotTarget(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setUserId(user.id);

      const [{ data: profile }, unread] = await Promise.all([
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single(),
        fetchUnreadDecisionCount(user.id),
      ]);

      if (profile?.username) {
        setUserInitial(profile.username.charAt(0).toUpperCase());
      }
      setUnreadCount(unread);
    } else {
      setUnreadCount(0);
    }

    const [habitatsRes, locationResult] = await Promise.all([
      supabase
        .from('habitats')
        .select('id, name, boundary, habitat_code, habitat_type, region, color'),
      ensureMapLocationOnOpen(),
    ]);

    if (!habitatsRes.error && habitatsRes.data) {
      setHabitats(habitatsRes.data);
    }

    setLocationMode(locationResult.mode);

    if (locationResult.center) {
      applyMapCenter(locationResult.center, locationResult.mode);
      setLocationBannerDismissed(true);
    } else {
      setMapCenterMode('default');
      setUserLocation(null);
      appliedLocationKeyRef.current = locationSettingsKey(locationResult.mode, null);
      if (!clearedLegacyBannerDismiss.current) {
        clearedLegacyBannerDismiss.current = true;
        await persistLocationBannerDismissed(false);
        setLocationBannerDismissed(false);
      }
    }

    mapHydratedRef.current = true;
    setLoading(false);
  }, [applyMapCenter]);

  /**
   * Returning from HabitatDetail (etc.) should keep the camera where the user left it.
   * Only re-center if location settings changed in Settings while away.
   */
  const softRefreshMap = useCallback(async () => {
    await refreshUnreadCount();

    const settings = await getMapLocationSettings();
    const nextKey = locationSettingsKey(settings.mode, settings.customCenter);
    if (nextKey === appliedLocationKeyRef.current) {
      setLocationMode(settings.mode);
      return;
    }

    if (settings.mode === 'custom' && settings.customCenter) {
      applyMapCenter(settings.customCenter, 'custom');
      setLocationBannerDismissed(true);
      return;
    }

    if (settings.mode === 'device') {
      const location = await getMapLocationIfPermitted();
      if (location) {
        applyMapCenter(location, 'device');
        setLocationBannerDismissed(true);
      } else {
        setLocationMode('device');
        appliedLocationKeyRef.current = nextKey;
      }
      return;
    }

    setLocationMode('off');
    setMapCenterMode('default');
    setUserLocation(null);
    appliedLocationKeyRef.current = 'off';
  }, [applyMapCenter, refreshUnreadCount]);

  const enterTourMap = useCallback(async (restartIfIdle: boolean) => {
    if (tourCompletingRef.current) return;

    setTourActive(true);
    setHabitats([ONBOARDING_DEMO_HABITAT as Habitat]);
    setMapCenterMode('polygons');
    setUserLocation(null);
    setLocationBannerDismissed(true);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profile?.username) {
        setUserInitial(profile.username.charAt(0).toUpperCase());
      }
    }

    const step = getTourStep();
    // Only start fresh when there is no active step — never when finishing ('done').
    if (restartIfIdle && !step) {
      startTour();
    }

    // Defer device location prompts until the live map loads after the tour.
    void getMapLocationSettings().then((settings) => {
      setLocationMode(settings.mode);
    });

    setLoading(false);
  }, []);

  const finishTour = useCallback(async () => {
    if (tourCompletingRef.current) return;
    tourCompletingRef.current = true;

    // Leave tutorial UI immediately so the user isn't stuck on the fake map.
    setTourActive(false);
    setSpotTarget(null);
    setTourStepState(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await setOnboardingComplete(user.id);
      }
      await loadLiveMap();
      setTourStep(null);
    } finally {
      tourCompletingRef.current = false;
    }
  }, [loadLiveMap]);

  const dismissLocationBanner = useCallback(async () => {
    setLocationBannerDismissed(true);
    await disableMapLocation();
    setLocationMode('off');
    setMapCenterMode('default');
    setUserLocation(null);
    appliedLocationKeyRef.current = 'off';
  }, []);

  useFocusEffect(useCallback(() => {
    void (async () => {
      if (tourCompletingRef.current) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!mapHydratedRef.current) {
          await loadLiveMap();
        } else {
          await softRefreshMap();
        }
        return;
      }

      const done = await isOnboardingComplete(user.id);
      if (done) {
        if (!mapHydratedRef.current) {
          await loadLiveMap();
        } else {
          await softRefreshMap();
        }
        return;
      }

      const step = getTourStep();
      // Finish was requested but storage/live map hasn't settled yet.
      if (step === 'done') {
        await finishTour();
        return;
      }

      // Restart only when tour was never started (null), not after finish cleared state.
      mapHydratedRef.current = false;
      await enterTourMap(!step);
    })();
  }, [enterTourMap, finishTour, loadLiveMap, softRefreshMap]));

  useEffect(() => {
    void getMapBasemapPreference().then(setBasemapMode);
  }, []);

  const toggleBasemap = useCallback(() => {
    setBasemapMode((prev) => {
      const next: MapBasemapMode = prev === 'streets' ? 'satellite' : 'streets';
      void setMapBasemapPreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribeTourStep((step) => {
      setTourStepState(step);
      if (step === 'done') {
        void finishTour();
      }
    });
  }, [finishTour]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshUnreadCount();
      }
    });
    return () => sub.remove();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!tourActive || !isMapChromeTourStep(tourStep)) {
      setSpotTarget(null);
      return;
    }

    let cancelled = false;
    const measure = async () => {
      // Allow layout to settle after map chrome mounts.
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled) return;

      if (tourStep === 'settings') {
        setSpotTarget(await measureRef(settingsRef));
      } else if (tourStep === 'bell') {
        setSpotTarget(await measureRef(bellRef));
      } else if (tourStep === 'propose') {
        setSpotTarget(await measureRef(proposeRef));
      } else {
        setSpotTarget(null);
      }
    };
    void measure();
    return () => {
      cancelled = true;
    };
  }, [tourActive, tourStep]);

  const handleLocationFab = useCallback(async () => {
    if (tourActive) return;
    setCenteringLocation(true);
    try {
      if (locationMode === 'custom') {
        const settings = await getMapLocationSettings();
        if (settings.customCenter) {
          applyMapCenter(settings.customCenter, 'custom');
        }
        return;
      }

      const location = await requestMapLocation();
      if (location) {
        await enableDeviceMapLocation();
        applyMapCenter(location, 'device');
        await persistLocationBannerDismissed(true);
      }
    } finally {
      setCenteringLocation(false);
    }
  }, [applyMapCenter, locationMode, tourActive]);

  const mapHabitats = tourActive
    ? [ONBOARDING_DEMO_HABITAT as Habitat]
    : habitats.filter((h) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return [h.name, h.habitat_code, h.habitat_type, h.region]
        .some((field) => field?.toLowerCase().includes(q));
    });

  const handleHabitatSelect = (habitatId: string) => {
    if (tourActive) {
      if (tourStep === 'tapHabitat' && habitatId === ONBOARDING_DEMO_HABITAT_ID) {
        setTourStep('overview');
        navigation.navigate('TutorialHabitatDetail');
      }
      return;
    }
    navigation.navigate('HabitatDetail', { habitatId });
  };

  const handleTourSkip = () => {
    void finishTour();
  };

  const handleTourBack = () => {
    if (tourStep === 'propose') {
      setTourStep('stewards');
      navigation.navigate('TutorialHabitatDetail');
      return;
    }
    retreatTour();
  };

  const handleTourNext = () => {
    if (tourStep === 'wrapUp') {
      void finishTour();
      return;
    }
    // Tapping the demo polygon is the intended path, but the button is the
    // guaranteed way forward when the shape is hard to hit.
    if (tourStep === 'tapHabitat') {
      setTourStep('overview');
      navigation.navigate('TutorialHabitatDetail');
      return;
    }
    advanceTour();
  };

  const chromeCopy = tourActive && isMapChromeTourStep(tourStep) && tourStep !== 'done'
    ? TOUR_COPY[tourStep as Exclude<TourStep, 'done'>]
    : null;

  const mapCenterForWebView = tourActive
    ? 'polygons' as const
    : (mapCenterMode === 'polygons' ? 'default' as const : mapCenterMode);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => {
            if (tourActive) return;
            if (userId) navigation.navigate('Profile', { userId });
          }}
        >
          <Text style={styles.avatarText}>{userInitial}</Text>
        </TouchableOpacity>

        <GlobalSearchBar
          onQueryChange={tourActive ? () => {} : setSearch}
          variant="light"
        />

        <View ref={bellRef} collapsable={false}>
          <NotificationBellButton
            unreadCount={tourActive ? 0 : unreadCount}
            onPress={() => {
              if (tourActive) return;
              navigation.navigate('ProposalNotifications');
            }}
            variant="light"
          />
        </View>

        <View ref={settingsRef} collapsable={false}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              if (tourActive) return;
              navigation.navigate('Settings');
            }}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4caf50" />
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <ArcGISMapWebView
            habitats={mapHabitats}
            onHabitatSelect={handleHabitatSelect}
            centerMode={mapCenterForWebView}
            userLocation={!tourActive && mapCenterMode === 'user' ? userLocation : null}
            centerNonce={centerNonce}
            basemapMode={basemapMode}
          />

          {!tourActive ? (
            <TouchableOpacity
              style={styles.basemapFab}
              onPress={toggleBasemap}
              accessibilityRole="button"
              accessibilityLabel={
                basemapMode === 'satellite' ? 'Switch to street map' : 'Switch to satellite map'
              }
            >
              <Text style={styles.basemapFabText}>
                {basemapMode === 'satellite' ? '🗺 Streets' : '🛰 Satellite'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {tourActive ? (
            <View style={styles.tourBanner} pointerEvents="none">
              <Text style={styles.tourBannerText}>Tutorial map — sample habitat only</Text>
            </View>
          ) : null}

          {showEnableBanner ? (
            <View style={styles.enableBanner}>
              <View style={styles.enableBannerHeader}>
                <Text style={styles.enableBannerTitle}>Location is off</Text>
                <TouchableOpacity
                  onPress={() => { void dismissLocationBanner(); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss location prompt"
                >
                  <Text style={styles.enableBannerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.enableBannerText}>
                Turn it on to center the map near you. If you previously declined, we will open Settings so you can allow access.
              </Text>
              <TouchableOpacity
                style={styles.enableBannerButton}
                onPress={handleLocationFab}
                disabled={centeringLocation}
              >
                {centeringLocation ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.enableBannerButtonText}>Enable location</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {!tourActive && !locationEnabled ? (
        <TouchableOpacity
          style={[styles.nearMeFab, styles.nearMeFabEmphasis]}
          onPress={handleLocationFab}
          disabled={centeringLocation}
        >
          {centeringLocation ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.nearMeFabText, styles.nearMeFabTextEmphasis]}>
              📍 Enable location
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      <View ref={proposeRef} collapsable={false} style={styles.proposeFabWrap}>
        <TouchableOpacity
          style={styles.proposeFab}
          onPress={() => {
            if (tourActive) return;
            navigation.navigate('SubmitHabitatProposal');
          }}
        >
          <Text style={styles.proposeFabText}>+ Propose habitat</Text>
        </TouchableOpacity>
      </View>

      {chromeCopy ? (
        <CoachMarkOverlay
          visible
          title={chromeCopy.title}
          body={chromeCopy.body}
          target={tourStep === 'welcome' || tourStep === 'tapHabitat' || tourStep === 'wrapUp' ? null : spotTarget}
          showNext={chromeCopy.showNext !== false}
          nextLabel={chromeCopy.nextLabel ?? 'Next'}
          onNext={handleTourNext}
          onSkip={handleTourSkip}
          showBack={canRetreatTour(tourStep)}
          onBack={handleTourBack}
          passThrough={tourStep === 'tapHabitat'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2e1a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 56,
    gap: 10,
    backgroundColor: '#1a2e1a',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    fontSize: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  basemapFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  basemapFabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a2e1a',
  },
  tourBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 46, 26, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tourBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  enableBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  enableBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  enableBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2e1a',
    flex: 1,
  },
  enableBannerClose: {
    fontSize: 18,
    color: '#888',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  enableBannerText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 14,
  },
  enableBannerButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  enableBannerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  nearMeFab: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  nearMeFabEmphasis: {
    backgroundColor: '#4caf50',
  },
  nearMeFabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2e1a',
  },
  nearMeFabTextEmphasis: {
    color: '#ffffff',
  },
  proposeFabWrap: {
    position: 'absolute',
    bottom: 28,
    right: 16,
  },
  proposeFab: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  proposeFabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
