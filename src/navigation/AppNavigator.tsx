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
import TutorialHabitatDetailScreen from '../screens/onboarding/TutorialHabitatDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ChooseMapAreaScreen from '../screens/settings/ChooseMapAreaScreen';
import ManageUsersScreen from '../screens/admin/ManageUsersScreen';
import StewardGroupScreen from '../screens/steward/StewardGroupScreen';
import StewardDashboardScreen from '../screens/steward/StewardDashboardScreen';
import TaskListScreen from '../screens/steward/TaskListScreen';
import TaskDetailScreen from '../screens/steward/TaskDetailScreen';
import CreateTaskScreen from '../screens/steward/CreateTaskScreen';
import FieldUpdateListScreen from '../screens/steward/FieldUpdateListScreen';
import CreateFieldUpdateScreen from '../screens/steward/CreateFieldUpdateScreen';
import FieldUpdateDetailScreen from '../screens/steward/FieldUpdateDetailScreen';
import SurveyListScreen from '../screens/steward/SurveyListScreen';
import CreateSurveyScreen from '../screens/steward/CreateSurveyScreen';
import SurveyDetailScreen from '../screens/steward/SurveyDetailScreen';
import EditSurveyScreen from '../screens/steward/EditSurveyScreen';
import EditHabitatOverviewScreen from '../screens/steward/EditHabitatOverviewScreen';
import EditHabitatLearnEventsScreen from '../screens/steward/EditHabitatLearnEventsScreen';
import EditHabitatSpeciesScreen from '../screens/steward/EditHabitatSpeciesScreen';
import SubmitHabitatProposalScreen from '../screens/habitat/SubmitHabitatProposalScreen';
import ReviewHabitatProposalsScreen from '../screens/admin/ReviewHabitatProposalsScreen';
import ReviewHabitatProposalDetailScreen from '../screens/admin/ReviewHabitatProposalDetailScreen';
import ProposalNotificationsScreen from '../screens/habitat/ProposalNotificationsScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  WorldMap: undefined;
  HabitatDetail: { habitatId: string };
  TutorialHabitatDetail: undefined;
  Profile: { userId: string };
  Settings: undefined;
  ChooseMapArea: undefined;
  ManageUsers: undefined;
  StewardGroup: { groupId: string };
  StewardDashboard: { groupId: string };
  TaskList: { groupId: string };
  TaskDetail: { groupId: string; taskId: string };
  CreateTask: { groupId: string };
  FieldUpdateList: { groupId: string };
  CreateFieldUpdate: { groupId: string };
  FieldUpdateDetail: { groupId: string; updateId: string };
  SurveyList: { habitatId: string };
  CreateSurvey: { habitatId: string; groupId: string };
  SurveyDetail: { surveyId: string; habitatId: string };
  EditSurvey: { surveyId: string; habitatId: string };
  EditHabitatOverview: { habitatId: string; groupId: string };
  EditHabitatLearnEvents: { habitatId: string; groupId: string };
  EditHabitatSpecies: { habitatId: string; groupId: string };
  SubmitHabitatProposal: undefined;
  ReviewHabitatProposals: undefined;
  ReviewHabitatProposalDetail: { proposalId: string };
  ProposalNotifications: undefined;
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
        <Stack.Screen name="HabitatDetail" component={HabitatDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TutorialHabitatDetail" component={TutorialHabitatDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChooseMapArea" component={ChooseMapAreaScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ManageUsers" component={ManageUsersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="StewardGroup" component={StewardGroupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="StewardDashboard" component={StewardDashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TaskList" component={TaskListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FieldUpdateList" component={FieldUpdateListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateFieldUpdate" component={CreateFieldUpdateScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FieldUpdateDetail" component={FieldUpdateDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SurveyList" component={SurveyListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateSurvey" component={CreateSurveyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SurveyDetail" component={SurveyDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditSurvey" component={EditSurveyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditHabitatOverview" component={EditHabitatOverviewScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditHabitatLearnEvents" component={EditHabitatLearnEventsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditHabitatSpecies" component={EditHabitatSpeciesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SubmitHabitatProposal" component={SubmitHabitatProposalScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReviewHabitatProposals" component={ReviewHabitatProposalsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReviewHabitatProposalDetail" component={ReviewHabitatProposalDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ProposalNotifications" component={ProposalNotificationsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
