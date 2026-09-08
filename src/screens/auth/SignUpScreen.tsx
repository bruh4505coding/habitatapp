import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import {
  assertUsernameCanBeClaimed,
  friendlyUsernameError,
  normalizeUsername,
} from '../../lib/username';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email.includes('@')) { Alert.alert('Error', 'Email must contain @.'); return false; }
    const passwordIsStrong = password.length >= 8
      && /[A-Z]/.test(password)
      && /[a-z]/.test(password)
      && /\d/.test(password)
      && /[^A-Za-z0-9]/.test(password);
    if (!passwordIsStrong) {
      Alert.alert(
        'Password requirements',
        'Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character.',
      );
      return false;
    }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords must match.'); return false; }
    return true;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    const nextUsername = normalizeUsername(username);
    setLoading(true);

    const claimError = await assertUsernameCanBeClaimed(nextUsername);
    if (claimError) {
      Alert.alert('Username unavailable', claimError);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      Alert.alert('Sign Up Failed', error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: nextUsername,
        email: email.trim(),
        role: 'user',
      });

      if (profileError) {
        Alert.alert('Profile Error', friendlyUsernameError(profileError.message));
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'WorldMap' }],
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Create account</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#888"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <Text style={styles.passwordHint}>
        3–30 characters · letters, numbers, _ or - · must be unique
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Text style={styles.passwordHint}>
        8+ characters · uppercase · lowercase · number · special character
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#888"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#111',
  },
  passwordInput: {
    marginBottom: 6,
  },
  passwordHint: {
    color: '#666',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: '#4caf50',
    fontSize: 14,
    textAlign: 'center',
  },
});
