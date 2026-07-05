import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

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
      </View>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1, // makes the View fill up the entire screen
    backgroundColor: '#1a2e1a', // dark green background color
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
    paddingVertical: 16, // adds vertical padding to the button
    borderRadius: 12, // makes the button rounded
    alignItems: 'center',
    marginBottom: 12, // adds margin to the bottom of the button
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%', // makes the button fill the entire width of the screen
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
});