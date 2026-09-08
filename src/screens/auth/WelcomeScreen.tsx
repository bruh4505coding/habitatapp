import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../../lib/legal';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

async function openUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through
  }
  Alert.alert('Unavailable', 'Could not open this link right now.');
}

export default function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>myHabitat</Text>
      <Text style={styles.tagline}>Map, document, and verify the world's habitats.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.primaryButtonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.secondaryButtonText}>Sign Up</Text>
      </TouchableOpacity>
      <View style={styles.legalRow}>
        <TouchableOpacity onPress={() => { void openUrl(PRIVACY_POLICY_URL); }}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.legalSep}>·</Text>
        <TouchableOpacity onPress={() => { void openUrl(TERMS_OF_USE_URL); }}>
          <Text style={styles.legalLink}>Terms of Use</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2e1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#a8c5a0',
    marginBottom: 48,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#4caf50',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  secondaryButtonText: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: '700',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    gap: 8,
  },
  legalLink: {
    color: '#a8c5a0',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: '#6f8a6a',
    fontSize: 13,
  },
});
