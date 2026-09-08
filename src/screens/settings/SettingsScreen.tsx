import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import {
  canManageUsers, roleColor, roleLabel, normalizeUserRole,
} from '../../lib/roles';
import {
  resetMapLocationPreferences,
  getMapLocationSettings,
  formatMapLocationStatus,
  isMapLocationCenteringOn,
  disableMapLocation,
  enableDeviceMapLocation,
  requestMapLocation,
  MapLocationSettings,
} from '../../lib/userLocation';
import { resetOnboarding } from '../../lib/onboarding';
import { startTour, setTourStep } from '../../lib/onboardingTour';
import { deleteOwnAccount } from '../../lib/deleteAccount';
import {
  assertUsernameCanBeClaimed,
  fetchUsernameChangesRemaining,
  friendlyUsernameError,
  normalizeUsername,
  USERNAME_MAX_CHANGES_PER_MONTH,
} from '../../lib/username';
import {
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
  TERMS_OF_USE_URL,
} from '../../lib/legal';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

async function openLegalUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through
  }
  Alert.alert('Unavailable', 'Could not open this link. Check that your privacy/terms pages are live.');
}

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const [username, setUsername] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('');
  const [usernameChangesLeft, setUsernameChangesLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingLocation, setResettingLocation] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [locationSettings, setLocationSettings] = useState<MapLocationSettings>({
    mode: 'off',
    customCenter: null,
  });

  // Same rule as status label: only true when centering is actually active.
  const locationOn = isMapLocationCenteringOn(locationSettings);

  const refreshLocationSettings = useCallback(async () => {
    const next = await getMapLocationSettings();
    setLocationSettings(next);
  }, []);

  useFocusEffect(useCallback(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data, error }, remaining] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, bio, role')
          .eq('id', user.id)
          .single(),
        fetchUsernameChangesRemaining(),
      ]);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const nextUsername = data.username ?? '';
        setUsername(nextUsername);
        setSavedUsername(nextUsername);
        setBio(data.bio ?? '');
        setRole(data.role ?? '');
      }

      setUsernameChangesLeft(remaining);
      await refreshLocationSettings();
      setLoading(false);
    };

    void fetchProfile();
  }, [refreshLocationSettings]));

  const handleSave = async () => {
    const nextUsername = normalizeUsername(username);
    const usernameChanged = nextUsername.toLowerCase() !== savedUsername.trim().toLowerCase();

    if (usernameChanged) {
      const claimError = await assertUsernameCanBeClaimed(nextUsername);
      if (claimError) {
        Alert.alert('Username unavailable', claimError);
        return;
      }
      if (usernameChangesLeft !== null && usernameChangesLeft <= 0) {
        Alert.alert(
          'Change limit reached',
          `You can only change your username ${USERNAME_MAX_CHANGES_PER_MONTH} times per month. Try again next month.`,
        );
        return;
      }
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: nextUsername, bio: bio.trim() })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      Alert.alert('Save Failed', friendlyUsernameError(error.message));
      return;
    }

    setSavedUsername(nextUsername);
    setUsername(nextUsername);
    if (usernameChanged) {
      const remaining = await fetchUsernameChangesRemaining();
      setUsernameChangesLeft(remaining);
    }
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear in-memory tour so the next account starts fresh.
    setTourStep(null);
    // Wipe the stack so swipe-back can't return to authenticated screens.
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const openDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and related profile data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setDeleteModalVisible(true);
          },
        },
      ],
    );
  };

  const closeDeleteModal = () => {
    if (deletingAccount) return;
    setDeleteModalVisible(false);
    setDeletePassword('');
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    const { error } = await deleteOwnAccount(deletePassword);
    setDeletingAccount(false);

    if (error) {
      Alert.alert('Could not delete account', error);
      return;
    }

    setDeleteModalVisible(false);
    setDeletePassword('');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const handleEnableDeviceLocation = async () => {
    setLocationBusy(true);
    try {
      const location = await requestMapLocation();
      if (location) {
        await enableDeviceMapLocation();
        setLocationSettings((prev) => ({
          mode: 'device',
          customCenter: prev.customCenter,
        }));
      }
    } finally {
      setLocationBusy(false);
    }
  };

  const handleDisableLocation = () => {
    Alert.alert(
      'Turn off map location?',
      'The map will stop auto-centering. You can turn it back on anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () => {
            // Flip the main button back to "Enable location" immediately.
            setLocationSettings({ mode: 'off', customCenter: null });
            void (async () => {
              setLocationBusy(true);
              try {
                await disableMapLocation();
              } finally {
                setLocationSettings({ mode: 'off', customCenter: null });
                setLocationBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleResetLocationPrefs = () => {
    Alert.alert(
      'Reset map location prefs?',
      'This clears the in-app location choice so the map can ask again.\n\nIf iOS already remembered Allow/Don’t Allow, also reset Location for myHabitat in iOS Settings, then reopen the map.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResettingLocation(true);
            await resetMapLocationPreferences();
            await refreshLocationSettings();
            setResettingLocation(false);
            Alert.alert(
              'Location prefs cleared',
              'Go back to the map to test the first-time location flow.\n\nTip: if the system dialog does not appear, reset Location permission for myHabitat in iOS Settings.',
            );
          },
        },
      ],
    );
  };

  const handleReplayIntroduction = () => {
    Alert.alert(
      'Replay introduction?',
      'You’ll see the tutorial map and walkthrough again. You can skip anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await resetOnboarding(user.id);
            }
            startTour();
            navigation.navigate('WorldMap');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Profile</Text>

      {role ? (
        <View style={[styles.roleBadge, { backgroundColor: roleColor(role) }]}>
          <Text style={styles.roleBadgeText}>{roleLabel(role)}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#888"
      />
      <Text style={styles.hint}>
        {usernameChangesLeft === null
          ? 'Usernames must be unique. You can change yours up to twice per month.'
          : usernameChangesLeft === 0
            ? 'No username changes left this month (limit: 2).'
            : `${usernameChangesLeft} username change${usernameChangesLeft === 1 ? '' : 's'} left this month.`}
      </Text>

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        placeholder="Tell others about yourself..."
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Map location</Text>
      <View style={styles.locationCard}>
        <Text style={styles.locationStatusLabel}>Current</Text>
        <Text style={styles.locationStatusValue}>
          {formatMapLocationStatus(locationSettings)}
        </Text>
        <Text style={styles.hint}>
          {locationOn
            ? 'Centering is on. Turn it off anytime, or pick a custom map area to work around.'
            : 'Location centering is off. Enable GPS centering, or pick a map area instead.'}
        </Text>
      </View>

      {/* STRICT: Off → Enable. On → Turn off. Same rule as "Current" status. */}
      {locationOn === false ? (
        <TouchableOpacity
          style={styles.locationPrimaryButton}
          onPress={handleEnableDeviceLocation}
          disabled={locationBusy}
        >
          {locationBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.locationPrimaryButtonText}>Enable location</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.disableLocationButton}
          onPress={handleDisableLocation}
          disabled={locationBusy}
        >
          <Text style={styles.disableLocationButtonText}>Turn off location centering</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.resetLocationButton}
        onPress={() => navigation.navigate('ChooseMapArea')}
        disabled={locationBusy}
      >
        <Text style={styles.resetLocationButtonText}>Choose map area</Text>
      </TouchableOpacity>

      {locationOn && locationSettings.mode === 'custom' ? (
        <TouchableOpacity
          style={styles.resetLocationButton}
          onPress={handleEnableDeviceLocation}
          disabled={locationBusy}
        >
          {locationBusy ? (
            <ActivityIndicator color="#1a2e1a" />
          ) : (
            <Text style={styles.resetLocationButtonText}>Use my device location</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionTitle}>Help</Text>
      <TouchableOpacity
        style={styles.resetLocationButton}
        onPress={handleReplayIntroduction}
      >
        <Text style={styles.resetLocationButtonText}>Replay introduction</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Show the first-time tutorial map and coach marks again.
      </Text>

      {__DEV__ ? (
        <>
          <Text style={styles.sectionTitle}>Testing</Text>
          <TouchableOpacity
            style={styles.resetLocationButton}
            onPress={handleResetLocationPrefs}
            disabled={resettingLocation}
          >
            {resettingLocation ? (
              <ActivityIndicator color="#1a2e1a" />
            ) : (
              <Text style={styles.resetLocationButtonText}>Reset map location prefs</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>
            Clears the saved center-on-me choice so you can retest asking for location.
          </Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Legal</Text>
      <TouchableOpacity
        style={styles.resetLocationButton}
        onPress={() => { void openLegalUrl(PRIVACY_POLICY_URL); }}
      >
        <Text style={styles.resetLocationButtonText}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.resetLocationButton}
        onPress={() => { void openLegalUrl(TERMS_OF_USE_URL); }}
      >
        <Text style={styles.resetLocationButtonText}>Terms of Use</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.resetLocationButton}
        onPress={() => { void openLegalUrl(SUPPORT_URL); }}
      >
        <Text style={styles.resetLocationButtonText}>Support</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Account</Text>

      <TouchableOpacity
        style={styles.proposeButton}
        onPress={() => navigation.navigate('SubmitHabitatProposal')}
      >
        <Text style={styles.proposeButtonText}>🗺️  Propose a New Habitat (KML)</Text>
      </TouchableOpacity>

      {canManageUsers(normalizeUserRole(role)) && (
        <>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigation.navigate('ReviewHabitatProposals')}
          >
            <Text style={styles.adminButtonText}>📋  Review Habitat Proposals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigation.navigate('ManageUsers')}
          >
            <Text style={styles.adminButtonText}>👤  Manage Users & Roles</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteAccountButton}
        onPress={openDeleteAccount}
        disabled={deletingAccount}
      >
        <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
      </TouchableOpacity>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <KeyboardAvoidingView
          style={styles.deleteModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Confirm deletion</Text>
            <Text style={styles.deleteModalBody}>
              Enter your password to permanently delete this account.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={deletePassword}
              onChangeText={setDeletePassword}
              editable={!deletingAccount}
            />
            <TouchableOpacity
              style={styles.deleteConfirmButton}
              onPress={confirmDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteConfirmButtonText}>Delete my account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteCancelButton}
              onPress={closeDeleteModal}
              disabled={deletingAccount}
            >
              <Text style={styles.deleteCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 24,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#111',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
  },
  locationStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  locationStatusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 8,
  },
  locationPrimaryButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  locationPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disableLocationButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c62828',
    marginBottom: 4,
  },
  disableLocationButtonText: {
    color: '#c62828',
    fontSize: 15,
    fontWeight: '700',
  },
  adminButton: {
    backgroundColor: '#e53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  resetLocationButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a2e1a',
    marginBottom: 8,
  },
  resetLocationButtonText: {
    color: '#1a2e1a',
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 8,
  },
  proposeButton: {
    backgroundColor: '#1a2e1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  proposeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e53935',
    marginBottom: 12,
  },
  logoutButtonText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteAccountButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#e53935',
    marginBottom: 40,
  },
  deleteAccountButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2e1a',
    marginBottom: 8,
  },
  deleteModalBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 14,
  },
  deleteConfirmButton: {
    backgroundColor: '#e53935',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
});
