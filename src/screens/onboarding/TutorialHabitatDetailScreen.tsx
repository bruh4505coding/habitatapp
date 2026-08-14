import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import HabitatOverviewWireframe from '../../components/habitat/HabitatOverviewWireframe';
import CoachMarkOverlay from '../../components/onboarding/CoachMarkOverlay';
import {
  ONBOARDING_DEMO_HABITAT,
  ONBOARDING_DEMO_OVERVIEW,
} from '../../lib/onboardingMockHabitat';
import {
  TourStep,
  TOUR_COPY,
  advanceTour,
  canRetreatTour,
  getTourStep,
  isDetailTourStep,
  retreatTour,
  setTourStep,
  skipTour,
  subscribeTourStep,
} from '../../lib/onboardingTour';
import { SURVEY_TYPE_COLORS, SURVEY_TYPE_LABELS } from '../../lib/surveys';
import { DEFAULT_HABITAT_PALETTE } from '../../lib/habitatTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'overview' | 'surveys' | 'stewards';

const ACCENT = ONBOARDING_DEMO_HABITAT.color ?? '#4caf50';

export default function TutorialHabitatDetailScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState<TourStep | null>(getTourStep());
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    return subscribeTourStep(setStep);
  }, []);

  useEffect(() => {
    if (step === 'overview') setActiveTab('overview');
    if (step === 'surveys') setActiveTab('surveys');
    if (step === 'stewards') setActiveTab('stewards');
  }, [step]);

  const handleSkip = () => {
    skipTour();
    navigation.goBack();
  };

  const handleBack = () => {
    if (step === 'overview') {
      setTourStep('tapHabitat');
      navigation.goBack();
      return;
    }
    retreatTour();
  };

  const handleNext = () => {
    if (step === 'stewards') {
      setTourStep('propose');
      navigation.goBack();
      return;
    }
    advanceTour();
  };

  const copy = step && isDetailTourStep(step) ? TOUR_COPY[step] : null;
  const demo = ONBOARDING_DEMO_OVERVIEW;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'surveys', label: 'Surveys' },
    { key: 'stewards', label: 'Stewards' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderLeftColor: ACCENT, borderLeftWidth: 4 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: ACCENT }]}>{'<< Map'}</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Habitat Overview</Text>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>Tutorial</Text>
          </View>
        </View>
        <View style={styles.nameRow}>
          <Text style={[styles.habitatName, { color: ACCENT }]}>
            {ONBOARDING_DEMO_HABITAT.habitat_code}
          </Text>
          <Text style={styles.habitatSubtitle}>{ONBOARDING_DEMO_HABITAT.name}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: ACCENT, borderBottomWidth: 2 }]}
            onPress={() => {
              if (isDetailTourStep(step)) return;
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: ACCENT, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' ? (
          <HabitatOverviewWireframe
            lastSurveyAt={demo.lastSurveyAt}
            conditionRating={demo.conditionRating}
            managementType={demo.managementType}
            managementCustom={demo.managementCustom}
            featureImageUrl={demo.featureImageUrl}
            learnLinks={demo.learnLinks}
            events={demo.events}
            characteristicFlora={demo.characteristicFlora}
            characteristicFauna={demo.characteristicFauna}
            stewardGroup={demo.stewardGroup}
            onStewardGroupPress={() => setActiveTab('stewards')}
            hasLastSurvey
            canEdit={false}
            accent={ACCENT}
            palette={DEFAULT_HABITAT_PALETTE}
          />
        ) : null}

        {activeTab === 'surveys' ? (
          <View style={styles.section}>
            <Text style={styles.subSectionTitle}>Sample survey</Text>
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={[styles.badge, { backgroundColor: SURVEY_TYPE_COLORS.general_habitat_check }]}>
                  <Text style={styles.badgeText}>{SURVEY_TYPE_LABELS.general_habitat_check}</Text>
                </View>
                <Text style={styles.cardDate}>Jun 15, 2026</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Condition: 4/5 · Good health with light invasive pressure near the trail.
              </Text>
            </View>
            <Text style={styles.empty}>
              On real habitats, stewards add surveys here after fieldwork.
            </Text>
          </View>
        ) : null}

        {activeTab === 'stewards' ? (
          <View style={styles.section}>
            <Text style={styles.subSectionTitle}>Steward group</Text>
            <View style={styles.card}>
              <Text style={styles.groupName}>{demo.stewardGroup.name}</Text>
              <Text style={styles.cardSubtitle}>
                Stewards organize restoration, track surveys, and keep the habitat overview up to date.
              </Text>
            </View>
            <Text style={styles.empty}>
              On the live map, opening Stewards takes you to the full group page.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {copy ? (
        <CoachMarkOverlay
          visible
          title={copy.title}
          body={copy.body}
          showNext={copy.showNext !== false}
          nextLabel={copy.nextLabel ?? 'Next'}
          onNext={handleNext}
          onSkip={handleSkip}
          showBack={canRetreatTour(step)}
          onBack={handleBack}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: 56,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2e1a',
  },
  demoBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2e7d32',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  habitatName: {
    fontSize: 16,
    fontWeight: '700',
  },
  habitatSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 48,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: -1,
  },
  tabText: { fontSize: 13, color: '#888' },
  content: { flex: 1 },
  section: { padding: 20 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empty: { fontSize: 14, color: '#aaa', marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 13, color: '#666', marginBottom: 4, lineHeight: 18 },
  cardDate: { fontSize: 12, color: '#aaa' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 6,
  },
});
