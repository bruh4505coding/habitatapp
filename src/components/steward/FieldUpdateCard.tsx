import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import {
  FieldUpdateRow,
  FIELD_UPDATE_CATEGORY_LABELS,
  FIELD_UPDATE_CATEGORY_COLORS,
  formatFieldUpdateDate,
  truncateBody,
} from '../../lib/fieldUpdates';

type Props = {
  update: FieldUpdateRow;
  onPress?: () => void;
  showVisibility?: boolean;
  compact?: boolean;
};

export default function FieldUpdateCard({
  update,
  onPress,
  showVisibility = true,
  compact = false,
}: Props) {
  const content = (
    <>
      <View style={styles.topRow}>
        <View style={[styles.categoryBadge, { backgroundColor: FIELD_UPDATE_CATEGORY_COLORS[update.category] }]}>
          <Text style={styles.categoryText}>{FIELD_UPDATE_CATEGORY_LABELS[update.category]}</Text>
        </View>
        {showVisibility ? (
          <View style={[styles.visibilityBadge, update.visibility === 'public' ? styles.publicBadge : styles.privateBadge]}>
            <Text style={[styles.visibilityText, update.visibility === 'public' ? styles.publicText : styles.privateText]}>
              {update.visibility === 'public' ? 'Public' : 'Private'}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{update.title}</Text>
      <Text style={styles.body} numberOfLines={compact ? 2 : 4}>
        {compact ? truncateBody(update.body, 100) : update.body}
      </Text>

      {update.photo_url ? (
        <Image source={{ uri: update.photo_url }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {update.author?.username ?? 'Unknown'}
          {update.habitats ? ` · ${update.habitats.habitat_code ?? update.habitats.name}` : ''}
        </Text>
        <Text style={styles.metaText}>{formatFieldUpdateDate(update.created_at)}</Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  visibilityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  publicBadge: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  privateBadge: { backgroundColor: '#f5f5f5', borderColor: '#ddd' },
  visibilityText: { fontSize: 11, fontWeight: '700' },
  publicText: { color: '#2e7d32' },
  privateText: { color: '#666' },
  title: { fontSize: 16, fontWeight: '700', color: '#1a2e1a', marginBottom: 6 },
  body: { fontSize: 14, color: '#555', lineHeight: 20 },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: '#eee',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  metaText: { fontSize: 12, color: '#888', flexShrink: 1 },
});
