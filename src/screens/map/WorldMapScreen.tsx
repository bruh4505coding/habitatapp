import React, { useCallback, useState } from 'react';
import {
  View, TouchableOpacity,
  StyleSheet, Text, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import ArcGISMapWebView from './ArcGISMapWebView';
import GlobalSearchBar from '../../components/GlobalSearchBar';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorldMap'>;

export type Habitat = {
  id: string;
  name: string;
  boundary: any;
  habitat_code: string | null;
  habitat_type: string | null;
  region: string | null;
  color: string | null;
};

export default function WorldMapScreen() {
  const navigation = useNavigation<Nav>();
  const [habitats, setHabitats] = useState<Habitat[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState('?');

  useFocusEffect(useCallback(() => {
    const fetchData = async () => {
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

      const { data, error } = await supabase
        .from('habitats')
        .select('id, name, boundary, habitat_code, habitat_type, region, color');

      if (!error && data) {
        setHabitats(data);
      }
      setLoading(false);
    };

    fetchData();
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredHabitats = habitats.filter((h) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [h.name, h.habitat_code, h.habitat_type, h.region]
      .some((field) => field?.toLowerCase().includes(q));
  });

  const handleHabitatSelect = (habitatId: string) => {
    navigation.navigate('HabitatDetail', { habitatId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => userId && navigation.navigate('Profile', { userId })}
        >
          <Text style={styles.avatarText}>{userInitial}</Text>
        </TouchableOpacity>

        <GlobalSearchBar
          onQueryChange={setSearch}
          variant="light"
        />

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4caf50" />
        </View>
      ) : (
        <ArcGISMapWebView
          habitats={filteredHabitats}
          onHabitatSelect={handleHabitatSelect}
        />
      )}
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
});
