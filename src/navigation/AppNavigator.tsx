import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import WorldMapScreen from '../screens/map/WorldMapScreen';
import HabitatDetailScreen from '../screens/habitat/HabitatDetailScreen';
import AddObservationScreen from '../screens/habitat/AddObservationScreen';
import AddContributionScreen from '../screens/habitat/AddContributionScreen';
import SubmitBoundaryEditScreen from '../screens/habitat/SubmitBoundaryEditScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import VerifierDashboardScreen from '../screens/verifier/VerifierDashboardScreen';
import ReviewSubmissionScreen from '../screens/verifier/ReviewSubmissionScreen';
import ManageUsersScreen from '../screens/admin/ManageUsersScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  WorldMap: undefined;
  HabitatDetail: { habitatId: string };
  AddObservation: { habitatId: string };
  AddContribution: { habitatId: string };
  SubmitBoundaryEdit: { habitatId: string };
  Profile: { userId: string };
  Settings: undefined;
  VerifierDashboard: undefined;
  ReviewSubmission: { submissionId: string; type: 'contribution' | 'boundary_edit' };
  ManageUsers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialRoute(session ? 'WorldMap' : 'Welcome');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f0' }}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="WorldMap" component={WorldMapScreen} />
        <Stack.Screen name="HabitatDetail" component={HabitatDetailScreen} options={{ headerShown: true, title: 'Habitat Detail' }} />
        <Stack.Screen name="AddObservation" component={AddObservationScreen} options={{ headerShown: true, title: 'Add Observation' }} />
        <Stack.Screen name="AddContribution" component={AddContributionScreen} options={{ headerShown: true, title: 'Add Contribution' }} />
        <Stack.Screen name="SubmitBoundaryEdit" component={SubmitBoundaryEditScreen} options={{ headerShown: true, title: 'Edit Boundary' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="VerifierDashboard" component={VerifierDashboardScreen} options={{ headerShown: true, title: 'Verifier Dashboard' }} />
        <Stack.Screen name="ReviewSubmission" component={ReviewSubmissionScreen} options={{ headerShown: true, title: 'Review Submission' }} />
        <Stack.Screen name="ManageUsers" component={ManageUsersScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
