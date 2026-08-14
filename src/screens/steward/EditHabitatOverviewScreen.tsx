import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Keyboard,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useGroupMembership } from '../../hooks/useGroupMembership';
import { isGroupLeadOrManager } from '../../lib/groupRoles';
import {
  MANAGEMENT_TYPES,
  MANAGEMENT_TYPE_LABELS,
  ManagementType,
  conditionTierLabel,
  fetchHabitatOverview,
  upsertHabitatOverview,
  isPdfUrl,
} from '../../lib/habitatOverview';
import {
  pickOverviewImage,
  pickOverviewDocument,
  uploadOverviewFile,
} from '../../lib/overviewMedia';
import {
  HABITAT_PALETTES,
  HabitatPaletteKey,
  getHabitatPalette,
} from '../../lib/habitatTheme';
import { useUserRole } from '../../hooks/useUserRole';
import { canManageUsers } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'EditHabitatOverview'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EditHabitatOverviewScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId, groupId } = route.params;
  const { memberRole, loading: membershipLoading } = useGroupMembership(groupId);
  const { role: platformRole, loading: roleLoading } = useUserRole();

  const [rating, setRating] = useState<number | null>(null);
  const [managementType, setManagementType] = useState<ManagementType | null>(null);
  const [managementCustom, setManagementCustom] = useState('');
  const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(null);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [pendingMimeType, setPendingMimeType] = useState<string | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [pendingBannerUri, setPendingBannerUri] = useState<string | null>(null);
  const [pendingBannerMimeType, setPendingBannerMimeType] = useState<string | null>(null);
  const [paletteKey, setPaletteKey] = useState<HabitatPaletteKey>('forest');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = canManageUsers(platformRole) || isGroupLeadOrManager(memberRole);
  const previewUri = pendingLocalUri ?? featureImageUrl;
  const bannerPreviewUri = pendingBannerUri ?? bannerImageUrl;
  const selectedPalette = getHabitatPalette(paletteKey);
  const previewIsPdf = pendingLocalUri
    ? (pendingMimeType?.includes('pdf') ?? false)
    : isPdfUrl(featureImageUrl);

  useEffect(() => {
    const load = async () => {
      const overview = await fetchHabitatOverview(groupId, habitatId);
      if (overview) {
        setRating(overview.condition_rating);
        setManagementType(overview.management_type);
        setManagementCustom(overview.management_custom ?? '');
        setFeatureImageUrl(overview.feature_image_url);
        setBannerImageUrl(overview.banner_image_url);
        setPaletteKey(overview.palette_key);
      }
      setLoading(false);
    };

    load();
  }, [groupId, habitatId]);

  const handlePickPhoto = async () => {
    const result = await pickOverviewImage();
    if (!result.ok) {
      if (result.reason === 'denied') {
        Alert.alert(
          'Photo access needed',
          'myHabitat needs access to your photo library so you can choose a habitat overview image. You can enable this in Settings.',
        );
      }
      return;
    }
    setPendingLocalUri(result.media.uri);
    setPendingMimeType(result.media.mimeType);
  };

  const handlePickFile = async () => {
    const picked = await pickOverviewDocument();
    if (!picked) return;
    setPendingLocalUri(picked.uri);
    setPendingMimeType(picked.mimeType);
  };

  const handleClearPhoto = () => {
    setPendingLocalUri(null);
    setPendingMimeType(null);
    setFeatureImageUrl(null);
  };

  const handlePickBanner = async () => {
    const result = await pickOverviewImage();
    if (!result.ok) {
      if (result.reason === 'denied') {
        Alert.alert(
          'Photo access needed',
          'Allow photo access in Settings to choose a habitat banner.',
        );
      }
      return;
    }
    setPendingBannerUri(result.media.uri);
    setPendingBannerMimeType(result.media.mimeType);
  };

  const handleClearBanner = () => {
    setPendingBannerUri(null);
    setPendingBannerMimeType(null);
    setBannerImageUrl(null);
  };

  const handleSubmit = async () => {
    if (managementType === 'other' && !managementCustom.trim()) {
      Alert.alert('Custom management required', 'Enter a label when choosing Other.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      Alert.alert('Sign in required', 'You must be signed in to save changes.');
      return;
    }

    let imageUrl = featureImageUrl;
    if (pendingLocalUri) {
      const { url, error: uploadError } = await uploadOverviewFile(
        pendingLocalUri,
        habitatId,
        groupId,
        pendingMimeType,
      );
      if (!url) {
        setSubmitting(false);
        Alert.alert(
          'Upload failed',
          uploadError ?? 'Could not upload the selected file. Try again.',
        );
        return;
      }
      imageUrl = url;
    }

    let nextBannerUrl = bannerImageUrl;
    if (pendingBannerUri) {
      const { url, error: uploadError } = await uploadOverviewFile(
        pendingBannerUri,
        habitatId,
        groupId,
        pendingBannerMimeType,
        'banner',
      );
      if (!url) {
        setSubmitting(false);
        Alert.alert(
          'Banner upload failed',
          uploadError ?? 'Could not upload the selected banner. Try again.',
        );
        return;
      }
      nextBannerUrl = url;
    }

    const { error } = await upsertHabitatOverview({
      steward_group_id: groupId,
      habitat_id: habitatId,
      condition_rating: rating,
      management_type: managementType,
      management_custom: managementType === 'other' ? managementCustom.trim() : null,
      feature_image_url: imageUrl,
      banner_image_url: nextBannerUrl,
      palette_key: paletteKey,
      updated_by: user.id,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Could not save', error);
    } else {
      Alert.alert('Overview updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading || membershipLoading || roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Only group leads, managers, and system admins can edit the habitat overview.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Edit Habitat Overview</Text>
      <Text style={styles.subtitle}>Appearance, condition, management, and photos</Text>

      <Text style={styles.label}>Color palette</Text>
      <View style={styles.paletteGrid}>
        {HABITAT_PALETTES.map((palette) => {
          const selected = palette.key === paletteKey;
          return (
            <TouchableOpacity
              key={palette.key}
              style={[
                styles.paletteOption,
                { backgroundColor: palette.background, borderColor: palette.border },
                selected && { borderColor: palette.accent, borderWidth: 3 },
              ]}
              onPress={() => setPaletteKey(palette.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={styles.paletteSwatches}>
                <View style={[styles.paletteSwatch, { backgroundColor: palette.accent }]} />
                <View style={[styles.paletteSwatch, { backgroundColor: palette.surface }]} />
                <View style={[styles.paletteSwatch, { backgroundColor: palette.text }]} />
              </View>
              <Text style={[styles.paletteLabel, { color: palette.text }]}>
                {selected ? '✓ ' : ''}{palette.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Habitat banner</Text>
      <Text style={styles.fieldHint}>Displayed across the top of the habitat overview.</Text>
      <View style={[styles.bannerPreview, { backgroundColor: selectedPalette.background }]}>
        {bannerPreviewUri ? (
          <Image source={{ uri: bannerPreviewUri }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <Text style={[styles.emptyPreviewText, { color: selectedPalette.muted }]}>
            No banner selected
          </Text>
        )}
      </View>
      <TouchableOpacity style={[styles.mediaButton, styles.bannerButton]} onPress={handlePickBanner}>
        <Text style={styles.mediaButtonText}>Choose banner photo</Text>
      </TouchableOpacity>
      {bannerPreviewUri ? (
        <TouchableOpacity onPress={handleClearBanner} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Remove banner</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.label}>Condition rating (1–5 stars)</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, rating === null && styles.chipActive]}
          onPress={() => setRating(null)}
        >
          <Text style={[styles.chipText, rating === null && styles.chipTextActive]}>Not set</Text>
        </TouchableOpacity>
        {[1, 2, 3, 4, 5].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, rating === r && styles.chipActive]}
            onPress={() => setRating(r)}
          >
            <Text style={[styles.chipText, rating === r && styles.chipTextActive]}>
              {r} · {conditionTierLabel(r)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Other management</Text>
      <View style={styles.chipRow}>
        {MANAGEMENT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, managementType === type && styles.chipActive]}
            onPress={() => setManagementType(type)}
          >
            <Text style={[styles.chipText, managementType === type && styles.chipTextActive]}>
              {MANAGEMENT_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {managementType === 'other' ? (
        <>
          <Text style={styles.label}>Custom management label</Text>
          <TextInput
            style={styles.input}
            value={managementCustom}
            onChangeText={setManagementCustom}
            placeholder="Describe the management type"
            placeholderTextColor="#aaa"
          />
        </>
      ) : null}

      <Text style={styles.label}>Feature photo or document</Text>
      <View style={styles.mediaPreview}>
        {previewUri && !previewIsPdf ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : previewUri && previewIsPdf ? (
          <View style={styles.pdfPreview}>
            <Text style={styles.pdfIcon}>📄</Text>
            <Text style={styles.pdfText}>PDF selected</Text>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>No file selected</Text>
          </View>
        )}
      </View>

      <View style={styles.mediaButtonRow}>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePickPhoto}>
          <Text style={styles.mediaButtonText}>Photo library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePickFile}>
          <Text style={styles.mediaButtonText}>File (image/PDF)</Text>
        </TouchableOpacity>
      </View>

      {previewUri ? (
        <TouchableOpacity onPress={handleClearPhoto} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Remove file</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Save Overview</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 20, paddingTop: 56 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f0f4f0' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a2e1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a2e1a',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 4,
  },
  chipActive: { backgroundColor: '#1a2e1a', borderColor: '#1a2e1a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteOption: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 74,
    justifyContent: 'space-between',
  },
  paletteSwatches: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  paletteSwatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  paletteLabel: { fontSize: 13, fontWeight: '700' },
  fieldHint: { fontSize: 12, color: '#888', marginTop: -4, marginBottom: 8 },
  bannerPreview: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bannerImage: { width: '100%', height: '100%' },
  mediaPreview: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8f8f5',
    minHeight: 140,
  },
  previewImage: { width: '100%', height: 180 },
  pdfPreview: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  pdfIcon: { fontSize: 40, marginBottom: 8 },
  pdfText: { fontSize: 14, color: '#555', fontWeight: '600' },
  emptyPreview: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyPreviewText: { fontSize: 14, color: '#888' },
  mediaButtonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  mediaButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    paddingVertical: 12,
    alignItems: 'center',
  },
  mediaButtonText: { fontSize: 13, fontWeight: '700', color: '#4caf50' },
  bannerButton: { flex: 0 },
  clearButton: { marginTop: 8, alignSelf: 'flex-start' },
  clearButtonText: { fontSize: 13, color: '#c62828', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 40,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  denied: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', textAlign: 'center', marginBottom: 12 },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
