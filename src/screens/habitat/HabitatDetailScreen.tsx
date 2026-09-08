import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import GlobalSearchBar from '../../components/GlobalSearchBar';
import HabitatOverviewWireframe from '../../components/habitat/HabitatOverviewWireframe';
import { useHabitatWorkspace } from '../../hooks/useHabitatWorkspace';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { isGroupLeadOrManager } from '../../lib/groupRoles';
import {
  SurveyRow, SURVEY_TYPE_LABELS, SURVEY_TYPE_COLORS,
  PRISTINENESS_LABELS, formatSurveyDate,
} from '../../lib/surveys';
import { fetchHabitatOverview, HabitatOverview } from '../../lib/habitatOverview';
import { repairStewardshipByHabitatId, fetchStewardGroupForHabitat } from '../../lib/habitatProposals';
import { useUserRole } from '../../hooks/useUserRole';
import { canManageUsers } from '../../lib/roles';
import { getHabitatPalette } from '../../lib/habitatTheme';

type Route = RouteProp<RootStackParamList, 'HabitatDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type StewardGroupLink = {
  id: string;
  name: string;
};
type Tab = 'overview' | 'surveys' | 'stewards';

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type HabitatData = {
  id: string;
  name: string;
  habitat_code: string | null;
  habitat_type: string | null;
  description: string | null;
  region: string | null;
  status: string | null;
  color: string | null;
  last_verified_at: string | null;
  last_survey_at: string | null;
};

export default function HabitatDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;
  const { hasAccess: hasWorkspaceAccess, groupId: workspaceGroupId } = useHabitatWorkspace(habitatId);
  const { memberRole } = useGroupMembership(workspaceGroupId ?? undefined);
  const { role: platformRole } = useUserRole();

  const canManagePlatform = canManageUsers(platformRole);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [habitat, setHabitat] = useState<HabitatData | null>(null);
  const [overview, setOverview] = useState<HabitatOverview | null>(null);
  const [stewardGroup, setStewardGroup] = useState<StewardGroupLink | null>(null);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [highlightSurveyId, setHighlightSurveyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingUpStewardship, setSettingUpStewardship] = useState(false);
  const editGroupId = workspaceGroupId ?? stewardGroup?.id ?? null;
  const canEditOverview = Boolean(editGroupId)
    && (
      canManagePlatform
      || (hasWorkspaceAccess && isGroupLeadOrManager(memberRole))
    );

  const loadStewardGroup = useCallback(async () => {
    const group = await fetchStewardGroupForHabitat(habitatId);
    setStewardGroup(group);
    return group;
  }, [habitatId]);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: habitatData, error } = await supabase
        .from('habitats')
        .select('id, name, habitat_code, habitat_type, description, region, status, color, last_verified_at')
        .eq('id', habitatId)
        .single();

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      let lastSurveyAt: string | null = null;
      const { data: surveyMeta } = await supabase
        .from('habitats')
        .select('last_survey_at')
        .eq('id', habitatId)
        .single();
      if (surveyMeta && 'last_survey_at' in surveyMeta) {
        lastSurveyAt = (surveyMeta as any).last_survey_at ?? null;
      }

      setHabitat({ ...habitatData, last_survey_at: lastSurveyAt });
      await loadStewardGroup();
      setLoading(false);
    };

    fetchAll();
  }, [habitatId, loadStewardGroup]);

  useFocusEffect(useCallback(() => {
    if (!loading) {
      loadStewardGroup();
    }
  }, [loading, loadStewardGroup]));

  const handleSetupStewardship = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSettingUpStewardship(true);
    const { error } = await repairStewardshipByHabitatId(habitatId, user.id);
    setSettingUpStewardship(false);

    if (error) {
      Alert.alert('Could not set up stewardship', error);
      return;
    }

    await loadStewardGroup();
    Alert.alert('Done', 'Steward group linked and submitter added as editor.');
  };

  const fetchSurveys = useCallback(async () => {
    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id, steward_group_id, habitat_id, created_by, survey_type,
        survey_date, weather, habitat_condition_notes, threats_observed,
        recommendations, pristineness_rating, visibility, created_at,
        creator:profiles!created_by ( username )
      `)
      .eq('habitat_id', habitatId)
      .order('survey_date', { ascending: false });

    if (error) {
      setSurveys([]);
    } else {
      setSurveys((data ?? []) as unknown as SurveyRow[]);
    }
  }, [habitatId]);

  const fetchOverview = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setOverview(null);
      return;
    }
    const data = await fetchHabitatOverview(groupId, habitatId);
    setOverview(data);
  }, [habitatId]);

  useFocusEffect(useCallback(() => {
    fetchSurveys();
    const overviewGroupId = workspaceGroupId ?? stewardGroup?.id ?? null;
    fetchOverview(overviewGroupId);
  }, [fetchSurveys, fetchOverview, workspaceGroupId, stewardGroup?.id]));

  useEffect(() => {
    const overviewGroupId = workspaceGroupId ?? stewardGroup?.id ?? null;
    fetchOverview(overviewGroupId);
  }, [workspaceGroupId, stewardGroup?.id, fetchOverview]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!habitat) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Habitat not found.</Text>
      </View>
    );
  }

  const palette = getHabitatPalette(overview?.palette_key);
  const accent = overview ? palette.accent : (habitat.color ?? palette.accent);
  const displayName = habitat.habitat_code ?? habitat.name;
  const isVerified = Boolean(habitat.last_verified_at);
  const today = todayISO();
  const lastPastSurvey = surveys.find((s) => s.survey_date <= today);

  const renderOverview = () => (
    <>
      {canManagePlatform && !stewardGroup ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupBannerText}>
            No steward group is linked to this habitat yet.
          </Text>
          <TouchableOpacity
            style={[styles.setupBannerButton, { borderColor: accent }]}
            onPress={handleSetupStewardship}
            disabled={settingUpStewardship}
          >
            {settingUpStewardship ? (
              <ActivityIndicator color={accent} size="small" />
            ) : (
              <Text style={[styles.setupBannerButtonText, { color: accent }]}>
                Set up steward group
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      <HabitatOverviewWireframe
      lastSurveyAt={habitat.last_survey_at}
      conditionRating={overview?.condition_rating ?? null}
      managementType={overview?.management_type ?? null}
      managementCustom={overview?.management_custom ?? null}
      featureImageUrl={overview?.feature_image_url ?? null}
      learnLinks={overview?.learn_links ?? []}
      events={overview?.events ?? []}
      characteristicFlora={overview?.characteristic_flora ?? []}
      characteristicFauna={overview?.characteristic_fauna ?? []}
      stewardGroup={stewardGroup}
      onStewardGroupPress={() => {
        if (stewardGroup) {
          navigation.navigate('StewardGroup', { groupId: stewardGroup.id });
        }
      }}
      hasLastSurvey={Boolean(lastPastSurvey)}
      onLastSurveyPress={() => {
        if (lastPastSurvey) {
          setHighlightSurveyId(lastPastSurvey.id);
          navigation.navigate('SurveyDetail', { surveyId: lastPastSurvey.id, habitatId });
        }
      }}
      canEdit={canEditOverview}
      onEditPress={() => {
        if (editGroupId) {
          navigation.navigate('EditHabitatOverview', { habitatId, groupId: editGroupId });
        }
      }}
      onEditLearnEventsPress={() => {
        if (editGroupId) {
          navigation.navigate('EditHabitatLearnEvents', { habitatId, groupId: editGroupId });
        }
      }}
      onEditSpeciesPress={() => {
        if (editGroupId) {
          navigation.navigate('EditHabitatSpecies', { habitatId, groupId: editGroupId });
        }
      }}
      accent={accent}
      palette={palette}
    />
    </>
  );

  const renderSurveyCard = (survey: SurveyRow) => (
    <TouchableOpacity
      key={survey.id}
      style={[
        styles.card,
        survey.id === highlightSurveyId && { borderColor: accent, borderWidth: 2 },
      ]}
      onPress={() => {
        setHighlightSurveyId(null);
        navigation.navigate('SurveyDetail', { surveyId: survey.id, habitatId });
      }}
    >
      <View style={styles.cardTopRow}>
        <View style={[styles.badge, { backgroundColor: SURVEY_TYPE_COLORS[survey.survey_type] }]}>
          <Text style={styles.badgeText}>{SURVEY_TYPE_LABELS[survey.survey_type]}</Text>
        </View>
        <Text style={styles.cardDate}>{formatSurveyDate(survey.survey_date)}</Text>
      </View>
      {survey.pristineness_rating ? (
        <Text style={styles.cardSubtitle}>
          Condition: {survey.pristineness_rating}/5 · {PRISTINENESS_LABELS[survey.pristineness_rating]}
        </Text>
      ) : null}
      {survey.habitat_condition_notes ? (
        <Text style={styles.cardSubtitle} numberOfLines={2}>{survey.habitat_condition_notes}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const renderSurveys = () => {
    const upcoming = surveys.filter((s) => s.survey_date > today);
    const past = surveys.filter((s) => s.survey_date <= today);

    return (
      <View style={styles.section}>
        {hasWorkspaceAccess && workspaceGroupId ? (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: accent, marginTop: 0, marginBottom: 20 }]}
            onPress={() => navigation.navigate('CreateSurvey', { habitatId, groupId: workspaceGroupId })}
          >
            <Text style={[styles.actionButtonText, { color: accent }]}>+ New Survey</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.subSectionTitle}>Upcoming Surveys</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>No upcoming surveys scheduled.</Text>
        ) : (
          upcoming.map(renderSurveyCard)
        )}

        <Text style={[styles.subSectionTitle, { marginTop: 20 }]}>Past Surveys</Text>
        {past.length === 0 ? (
          <Text style={styles.empty}>No past surveys recorded.</Text>
        ) : (
          past.map(renderSurveyCard)
        )}
      </View>
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'surveys', label: 'Surveys' },
    ...(stewardGroup ? [{ key: 'stewards' as Tab, label: 'Stewards' }] : []),
  ];

  const handleTabPress = (tab: Tab) => {
    if (tab === 'stewards' && stewardGroup) {
      navigation.navigate('StewardGroup', { groupId: stewardGroup.id });
      return;
    }
    setHighlightSurveyId(null);
    setActiveTab(tab);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[
        styles.header,
        {
          backgroundColor: palette.surface,
          borderBottomColor: palette.border,
          borderLeftColor: accent,
          borderLeftWidth: 4,
        },
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: accent }]}>{'<< Map'}</Text>
        </TouchableOpacity>
        <View style={styles.searchRow}>
          <GlobalSearchBar fullWidth variant="light" />
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Habitat Overview</Text>
        </View>
        <View style={styles.nameRow}>
          <Text style={[styles.habitatNameGreen, { color: accent }]}>{displayName}</Text>
          {isVerified ? (
            <Text style={styles.verifiedBadge}>verified ✓</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: accent, borderBottomWidth: 2 }]}
            onPress={() => handleTabPress(tab.key)}
          >
            <Text style={[
              styles.tabText,
              { color: palette.muted },
              activeTab === tab.key && { color: accent, fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={[styles.content, { backgroundColor: palette.background }]}>
        {activeTab === 'overview' && overview?.banner_image_url ? (
          <Image
            source={{ uri: overview.banner_image_url }}
            style={styles.habitatBanner}
            resizeMode="cover"
            accessibilityLabel={`${displayName} habitat banner`}
          />
        ) : null}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'surveys' && renderSurveys()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#555' },
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
  searchRow: { marginBottom: 12, zIndex: 100 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2e1a',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  habitatNameGreen: {
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedBadge: {
    fontSize: 13,
    color: '#555',
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
  habitatBanner: { width: '100%', height: 170 },
  section: { padding: 20 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empty: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#666', marginBottom: 4 },
  cardDate: { fontSize: 12, color: '#aaa' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: { fontSize: 15, fontWeight: '700' },
  setupBanner: {
    margin: 20,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  setupBannerText: { fontSize: 14, color: '#555', marginBottom: 12, lineHeight: 20 },
  setupBannerButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  setupBannerButtonText: { fontSize: 14, fontWeight: '700' },
});
