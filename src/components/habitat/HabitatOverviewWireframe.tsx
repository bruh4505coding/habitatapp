import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, Pressable, ScrollView, Linking,
} from 'react-native';
import { Alert } from '../../lib/alert';
import {
  formatManagementLabel,
  formatLastSurveyDate,
  conditionTierLabel,
  isPdfUrl,
  LearnLink,
  OverviewEvent,
  LEARN_LINKS_PREVIEW,
  EVENTS_PREVIEW,
} from '../../lib/habitatOverview';
import { HabitatPalette } from '../../lib/habitatTheme';

type StewardGroupLink = {
  id: string;
  name: string;
};

type Props = {
  lastSurveyAt: string | null;
  conditionRating: number | null;
  managementType: string | null;
  managementCustom: string | null;
  featureImageUrl: string | null;
  learnLinks: LearnLink[];
  events: OverviewEvent[];
  characteristicFlora: string[];
  characteristicFauna: string[];
  stewardGroup: StewardGroupLink | null;
  onStewardGroupPress: () => void;
  onLastSurveyPress?: () => void;
  hasLastSurvey?: boolean;
  onEditPress?: () => void;
  onEditLearnEventsPress?: () => void;
  onEditSpeciesPress?: () => void;
  canEdit?: boolean;
  accent: string;
  palette: HabitatPalette;
};

function InfoButton({
  title,
  message,
  accent,
}: {
  title: string;
  message: string;
  accent: string;
}) {
  return (
    <TouchableOpacity
      onPress={() => Alert.alert(title, message)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`About ${title}`}
    >
      <Text style={[styles.infoIcon, { color: accent }]}>ⓘ</Text>
    </TouchableOpacity>
  );
}

function SpeciesScrollList({ items, palette }: { items: string[]; palette: HabitatPalette }) {
  if (items.length === 0) {
    return <Text style={[styles.mutedSmall, { color: palette.muted }]}>None listed yet.</Text>;
  }

  return (
    <ScrollView
      style={styles.speciesScroll}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={[styles.bulletItem, { color: palette.text }]}>• {item}</Text>
      ))}
    </ScrollView>
  );
}

function StarRating({ rating, palette }: { rating: number | null; palette: HabitatPalette }) {
  if (rating === null) {
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Text key={i} style={[styles.star, { color: palette.border }]}>★</Text>
        ))}
        <Text style={[styles.notRatedLabel, { color: palette.muted }]}>Not rated</Text>
      </View>
    );
  }

  const filled = Math.round(Math.max(1, Math.min(5, rating)));
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { color: i <= filled ? palette.accent : palette.border }]}
        >
          ★
        </Text>
      ))}
      <Text style={[styles.intactLabel, { color: palette.text }]}>{conditionTierLabel(rating)}</Text>
    </View>
  );
}

function FeatureMedia({ url, palette }: { url: string | null; palette: HabitatPalette }) {
  if (!url) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Text style={styles.imagePlaceholderText}>🏞</Text>
      </View>
    );
  }

  if (isPdfUrl(url)) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Text style={styles.imagePlaceholderText}>📄</Text>
        <Text style={styles.pdfLabel}>PDF</Text>
      </View>
    );
  }

  return (
    <Image source={{ uri: url }} style={styles.featureImage} resizeMode="cover" />
  );
}

function DashedRule({ color }: { color: string }) {
  return <View style={[styles.dashedRule, { borderBottomColor: color }]} />;
}

export default function HabitatOverviewWireframe({
  lastSurveyAt,
  conditionRating,
  managementType,
  managementCustom,
  featureImageUrl,
  learnLinks,
  events,
  characteristicFlora,
  characteristicFauna,
  stewardGroup,
  onStewardGroupPress,
  onLastSurveyPress,
  hasLastSurvey,
  onEditPress,
  onEditLearnEventsPress,
  onEditSpeciesPress,
  canEdit,
  accent,
  palette,
}: Props) {
  const [showAllLearn, setShowAllLearn] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null);

  const managementLabel = formatManagementLabel(
    managementType as Parameters<typeof formatManagementLabel>[0],
    managementCustom,
  );

  const previewLearn = learnLinks.slice(0, LEARN_LINKS_PREVIEW);
  const previewEvents = events.slice(0, EVENTS_PREVIEW);

  const openLearnUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open link', url);
      }
    } catch {
      Alert.alert('Cannot open link', url);
    }
  };

  const renderLearnRow = (link: LearnLink, key: string) => (
    <TouchableOpacity key={key} onPress={() => openLearnUrl(link.url)}>
      <Text style={[styles.learnLink, { color: accent }]} numberOfLines={2}>
        {link.title}
      </Text>
    </TouchableOpacity>
  );

  const renderEventRow = (event: OverviewEvent, key: string) => (
    <TouchableOpacity key={key} onPress={() => setSelectedEvent(event)}>
      <Text style={[styles.eventItem, { color: accent }]} numberOfLines={2}>
        • {event.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.content, { backgroundColor: palette.background }]}>
      {canEdit && onEditPress ? (
        <TouchableOpacity style={[styles.editButton, { borderColor: accent }]} onPress={onEditPress}>
          <Text style={[styles.editButtonText, { color: accent }]}>Edit Overview</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Card 1 ── */}
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.card1Row}>
          <View style={styles.card1Left}>
            <StarRating rating={conditionRating} palette={palette} />

            <Text style={[styles.sectionHeading, { color: palette.text }]}>Habitat Steward(s)</Text>
            {stewardGroup ? (
              <TouchableOpacity onPress={onStewardGroupPress}>
                <Text style={[styles.link, { color: accent }]}>{stewardGroup.name}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.muted, { color: palette.muted }]}>—</Text>
            )}

            <Text style={[styles.bodyText, { color: palette.text }]}>
              Other management: {'>>'} {managementLabel ?? '—'}
            </Text>
          </View>

          <View style={styles.card1Right}>
            <FeatureMedia url={featureImageUrl} palette={palette} />
            {hasLastSurvey && onLastSurveyPress ? (
              <TouchableOpacity onPress={onLastSurveyPress} style={styles.lastSurveyTouchable}>
                <Text style={[styles.lastSurvey, { color: palette.muted }]}>
                  Last Survey:{' '}
                  <Text style={[styles.lastSurveyLink, { color: accent }]}>
                    {formatLastSurveyDate(lastSurveyAt)}
                  </Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.lastSurvey, { color: palette.muted }]}>
                Last Survey: {formatLastSurveyDate(lastSurveyAt)}
              </Text>
            )}
          </View>
        </View>
      </View>

      <DashedRule color={palette.border} />

      {/* ── Card 2 ── */}
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.headingRow}>
          <View style={styles.titleCluster}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Biodiversity Snapshot</Text>
            <InfoButton
              title="Biodiversity Snapshot"
              message="A summary of the biodiversity found within this habitat"
              accent={accent}
            />
          </View>
        </View>

        <View style={styles.card2Row}>
          <View style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: palette.text }]}>Species Richness</Text>
            <Text style={[styles.statValue, { color: palette.muted }]}>Not available yet</Text>
          </View>
        </View>
      </View>

      <DashedRule color={palette.border} />

      {/* ── Card 3 ── */}
      <View style={styles.card3Row}>
        <View style={[
          styles.card,
          styles.card3Left,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}>
          <View style={styles.headingRow}>
            <Text
              style={[styles.cardTitle, styles.cardTitleFlexible, { color: palette.text }]}
              numberOfLines={2}
            >
              Characteristic Species
            </Text>
            {canEdit && onEditSpeciesPress ? (
              <TouchableOpacity onPress={onEditSpeciesPress} style={styles.inlineEdit} hitSlop={8}>
                <Text style={[styles.inlineEditText, { color: accent }]}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.speciesColumns}>
            <View style={styles.speciesCol}>
              <Text style={[styles.speciesHeading, { color: palette.text }]}>Flora</Text>
              <SpeciesScrollList items={characteristicFlora} palette={palette} />
            </View>

            <View style={styles.speciesCol}>
              <Text style={[styles.speciesHeading, { color: palette.text }]}>Fauna</Text>
              <SpeciesScrollList items={characteristicFauna} palette={palette} />
            </View>
          </View>
        </View>

        <View style={[
          styles.card,
          styles.card3Right,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}>
          <View style={styles.headingRow}>
            <View style={styles.titleCluster}>
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>Learn</Text>
              <InfoButton
                title="Learn"
                message="Links to learn about this area"
                accent={accent}
              />
            </View>
            {canEdit && onEditLearnEventsPress ? (
              <TouchableOpacity onPress={onEditLearnEventsPress} style={styles.inlineEdit} hitSlop={8}>
                <Text style={[styles.inlineEditText, { color: accent }]}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {learnLinks.length === 0 ? (
            <Text style={[styles.mutedSmall, { color: palette.muted }]}>No learn links yet.</Text>
          ) : (
            <>
              {previewLearn.map((link, index) => renderLearnRow(link, `${link.url}-${index}`))}
              {learnLinks.length > LEARN_LINKS_PREVIEW ? (
                <TouchableOpacity onPress={() => setShowAllLearn(true)}>
                  <Text style={[styles.moreLink, { color: accent }]}>
                    View all {learnLinks.length} links →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <View style={[styles.headingRow, styles.eventsHeading]}>
            <View style={styles.titleCluster}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Events</Text>
              <InfoButton
                title="Events"
                message="Upcoming events in this habitat"
                accent={accent}
              />
            </View>
          </View>

          {events.length === 0 ? (
            <Text style={[styles.mutedSmall, { color: palette.muted }]}>No events yet.</Text>
          ) : (
            <>
              {previewEvents.map((event, index) => renderEventRow(event, `${event.title}-${index}`))}
              {events.length > EVENTS_PREVIEW ? (
                <TouchableOpacity onPress={() => setShowAllEvents(true)}>
                  <Text style={[styles.moreLink, { color: accent }]}>
                    View all {events.length} events →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* All learn links modal */}
      <Modal visible={showAllLearn} transparent animationType="fade" onRequestClose={() => setShowAllLearn(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAllLearn(false)} />
          <View style={styles.listModal}>
            <View style={styles.listModalHeader}>
              <Text style={styles.listModalTitle}>Learn</Text>
              <TouchableOpacity onPress={() => setShowAllLearn(false)} hitSlop={12}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.listModalScroll}>
              {learnLinks.map((link, index) => (
                <TouchableOpacity
                  key={`all-learn-${index}`}
                  style={styles.listModalRow}
                  onPress={() => {
                    setShowAllLearn(false);
                    openLearnUrl(link.url);
                  }}
                >
                  <Text style={[styles.listModalRowTitle, { color: accent }]}>{link.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* All events modal */}
      <Modal visible={showAllEvents} transparent animationType="fade" onRequestClose={() => setShowAllEvents(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAllEvents(false)} />
          <View style={styles.listModal}>
            <View style={styles.listModalHeader}>
              <Text style={styles.listModalTitle}>Events</Text>
              <TouchableOpacity onPress={() => setShowAllEvents(false)} hitSlop={12}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.listModalScroll}>
              {events.map((event, index) => (
                <TouchableOpacity
                  key={`all-event-${index}`}
                  style={styles.listModalRow}
                  onPress={() => {
                    setShowAllEvents(false);
                    setSelectedEvent(event);
                  }}
                >
                  <Text style={[styles.listModalRowTitle, { color: accent }]}>{event.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Event detail overlay */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedEvent(null)} />
          <View style={styles.eventDetailModal}>
            <View style={styles.listModalHeader}>
              <Text style={styles.eventDetailTitle} numberOfLines={2}>
                {selectedEvent?.title}
              </Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} hitSlop={12}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.eventDetailScroll}>
              <Text style={styles.eventDetailBody}>
                {selectedEvent?.description?.trim()
                  ? selectedEvent.description
                  : 'No description provided.'}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  editButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  editButtonText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    marginBottom: 4,
    overflow: 'hidden',
  },
  dashedRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  card1Row: { flexDirection: 'row', gap: 12 },
  card1Left: { flex: 1, gap: 8 },
  card1Right: { width: 130, alignItems: 'stretch' },
  starRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 4 },
  star: { fontSize: 16 },
  starFilled: { color: '#1a2e1a' },
  starEmpty: { color: '#ccc' },
  intactLabel: { fontSize: 14, fontWeight: '600', color: '#1a2e1a', marginLeft: 6 },
  notRatedLabel: { fontSize: 13, color: '#888', marginLeft: 6, fontStyle: 'italic' },
  sectionHeading: { fontSize: 14, fontWeight: '700', color: '#1a2e1a', marginTop: 4 },
  bodyText: { fontSize: 13, color: '#333', lineHeight: 18 },
  imagePlaceholder: {
    flex: 1,
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#aaa',
    backgroundColor: '#f8f8f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 36 },
  pdfLabel: { fontSize: 11, color: '#555', marginTop: 4, fontWeight: '600' },
  featureImage: { flex: 1, minHeight: 110, borderWidth: 1, borderColor: '#aaa' },
  lastSurvey: { fontSize: 11, color: '#444', marginTop: 6, textAlign: 'right', lineHeight: 15 },
  lastSurveyTouchable: { marginTop: 6, alignSelf: 'stretch' },
  lastSurveyLink: { fontWeight: '600', textDecorationLine: 'underline' },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a2e1a' },
  cardTitleFlexible: { flex: 1, flexShrink: 1, minWidth: 0 },
  infoIcon: {
    fontSize: 13,
    color: '#c62828',
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 1,
  },
  inlineEdit: { flexShrink: 0 },
  inlineEditText: { fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  card2Row: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  statBlock: { marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#1a2e1a', marginBottom: 2 },
  statValue: { fontSize: 14, color: '#333' },
  link: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  muted: { fontSize: 13, color: '#888' },
  mutedSmall: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 8 },
  card3Row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  card3Left: { flex: 1 },
  card3Right: { flex: 1 },
  speciesColumns: { flexDirection: 'row', gap: 8 },
  speciesCol: { flex: 1, minHeight: 120 },
  speciesHeading: { fontSize: 13, fontWeight: '700', color: '#1a2e1a', marginBottom: 6 },
  speciesScroll: { maxHeight: 160 },
  bulletItem: { fontSize: 12, color: '#333', lineHeight: 18, marginBottom: 2 },
  learnLink: { fontSize: 12, textDecorationLine: 'underline', marginBottom: 8, lineHeight: 16 },
  moreLink: { fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  eventsHeading: { marginTop: 14, marginBottom: 8 },
  eventItem: { fontSize: 12, lineHeight: 18, marginBottom: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  listModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '55%',
    overflow: 'hidden',
    zIndex: 1,
  },
  listModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  listModalTitle: { fontSize: 18, fontWeight: '800', color: '#1a2e1a' },
  closeIcon: { fontSize: 20, color: '#666', fontWeight: '700' },
  listModalScroll: { maxHeight: 320 },
  listModalRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listModalRowTitle: { fontSize: 15, fontWeight: '600' },
  eventDetailModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '78%',
    minHeight: '55%',
    overflow: 'hidden',
    zIndex: 1,
  },
  eventDetailTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', flex: 1 },
  eventDetailScroll: { padding: 16 },
  eventDetailBody: { fontSize: 16, color: '#333', lineHeight: 24 },
});
