import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import ArcGISMapWebView from '../map/ArcGISMapWebView';
import { Habitat } from '../map/WorldMapScreen';
import {
  MapCenter,
  getMapLocationSettings,
  getMapLocationIfPermitted,
  setCustomMapCenter,
} from '../../lib/userLocation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ChooseMapArea'>;

export default function ChooseMapAreaScreen() {
  const navigation = useNavigation<Nav>();
  const [habitats, setHabitats] = useState<Habitat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<MapCenter | null>(null);
  const [initialCenter, setInitialCenter] = useState<MapCenter | null>(null);

  useEffect(() => {
    const load = async () => {
      const [habitatsRes, settings, deviceLocation] = await Promise.all([
        supabase
          .from('habitats')
          .select('id, name, boundary, habitat_code, habitat_type, region, color'),
        getMapLocationSettings(),
        getMapLocationIfPermitted(),
      ]);

      if (!habitatsRes.error && habitatsRes.data) {
        setHabitats(habitatsRes.data as Habitat[]);
      }

      const seed = settings.customCenter ?? deviceLocation;
      if (seed) {
        setInitialCenter(seed);
        setPicked(seed);
      }
      setLoading(false);
    };

    void load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!picked) {
      Alert.alert('Pick a spot', 'Tap the map to choose where the overview should center.');
      return;
    }

    setSaving(true);
    await setCustomMapCenter(picked);
    setSaving(false);
    Alert.alert('Saved work area', 'The map will open centered on this area.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [picked, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose map area</Text>
        <Text style={styles.subtitle}>
          Tap the map to set a work area. The world map will open centered here instead of your GPS location.
        </Text>
      </View>

      <View style={styles.mapWrap}>
        <ArcGISMapWebView
          habitats={habitats}
          onHabitatSelect={() => {}}
          centerMode={initialCenter ? 'user' : 'default'}
          userLocation={picked ?? initialCenter}
          pickMode
          onMapPointSelect={setPicked}
        />
      </View>

      <View style={styles.footer}>
        {picked ? (
          <Text style={styles.coords}>
            Selected: {picked.latitude.toFixed(4)}, {picked.longitude.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.coordsMuted}>No point selected yet</Text>
        )}
        <TouchableOpacity
          style={[styles.saveButton, (!picked || saving) && styles.saveDisabled]}
          onPress={handleSave}
          disabled={!picked || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Use this area</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f0' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a2e1a' },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginTop: 6 },
  mapWrap: { flex: 1 },
  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  coords: { fontSize: 13, color: '#1a2e1a', fontWeight: '600', marginBottom: 10 },
  coordsMuted: { fontSize: 13, color: '#888', marginBottom: 10 },
  saveButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.55 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
