import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { roleColor, roleLabel } from '../../lib/roles';
import GlobalSearchBar from '../../components/GlobalSearchBar';

type Route = RouteProp<RootStackParamList, 'Profile'>;

type Profile = {
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  role: string;
};

export default function ProfileScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { userId } = route.params;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, bio, profile_picture_url, role')
        .eq('id', userId)
        .single();

      if (profileError) {
        Alert.alert('Error', profileError.message);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>Profile not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.searchRow}>
        <GlobalSearchBar fullWidth variant="light" />
      </View>

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.username}>{profile.username}</Text>
          <View style={[styles.badge, { backgroundColor: roleColor(profile.role) }]}>
            <Text style={styles.badgeText}>{roleLabel(profile.role)}</Text>
          </View>
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    padding: 20,
    paddingTop: 56,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#4caf50',
    fontWeight: '600',
  },
  searchRow: {
    marginBottom: 16,
    zIndex: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    lineHeight: 20,
  },
});
