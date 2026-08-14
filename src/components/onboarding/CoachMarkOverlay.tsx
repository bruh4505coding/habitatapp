import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';

export type SpotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  title: string;
  body: string;
  /** Measured with measureInWindow; omit for centered / map-pass-through tips. */
  target?: SpotRect | null;
  showNext?: boolean;
  nextLabel?: string;
  onNext?: () => void;
  onSkip: () => void;
  showBack?: boolean;
  onBack?: () => void;
  /**
   * When true (e.g. tap-habitat step), only the tip card captures touches
   * so the map underneath stays interactive.
   */
  passThrough?: boolean;
};

const HOLE_PAD = 6;
const HOLE_RADIUS = 12;

export default function CoachMarkOverlay({
  visible,
  title,
  body,
  target = null,
  showNext = true,
  nextLabel = 'Next',
  onNext,
  onSkip,
  showBack = false,
  onBack,
  passThrough = false,
}: Props) {
  const { height: winH } = useWindowDimensions();

  const hole = useMemo(() => {
    if (!target) return null;
    return {
      left: Math.max(0, target.x - HOLE_PAD),
      top: Math.max(0, target.y - HOLE_PAD),
      width: target.width + HOLE_PAD * 2,
      height: target.height + HOLE_PAD * 2,
    };
  }, [target]);

  const cardStyle = useMemo(() => {
    if (passThrough) {
      return { bottom: 100, left: 24, right: 24 };
    }
    if (!hole) {
      return { top: winH * 0.28, left: 24, right: 24 };
    }
    const holeBottom = hole.top + hole.height;
    const spaceBelow = winH - holeBottom;
    if (spaceBelow > 180) {
      return {
        top: Math.min(holeBottom + 16, winH - 200),
        left: 24,
        right: 24,
      };
    }
    return {
      bottom: Math.max(24, winH - hole.top + 8),
      left: 24,
      right: 24,
    };
  }, [hole, passThrough, winH]);

  if (!visible) return null;

  return (
    <View
      style={styles.root}
      pointerEvents={passThrough ? 'box-none' : 'auto'}
    >
      {!passThrough && hole ? (
        <>
          <View style={[styles.scrim, { top: 0, left: 0, right: 0, height: hole.top }]} />
          <View
            style={[
              styles.scrim,
              { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 },
            ]}
          />
          <View
            style={[
              styles.scrim,
              { top: hole.top, left: 0, width: hole.left, height: hole.height },
            ]}
          />
          <View
            style={[
              styles.scrim,
              {
                top: hole.top,
                left: hole.left + hole.width,
                right: 0,
                height: hole.height,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.holeRing,
              {
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: HOLE_RADIUS,
              },
            ]}
          />
          {/* Block taps on the spotlighted control during tour chrome steps. */}
          <View
            style={{
              position: 'absolute',
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : null}

      {!passThrough && !hole ? (
        <View style={styles.fullScrim} />
      ) : null}

      <View style={[styles.card, cardStyle]} pointerEvents="auto">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.skip}>Skip</Text>
            </TouchableOpacity>
            {showBack && onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.back}>Back</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {showNext && onNext ? (
            <TouchableOpacity style={styles.nextButton} onPress={onNext}>
              <Text style={styles.nextText}>{nextLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.nextPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  fullScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scrim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  holeRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#81c784',
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2e1a',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
    paddingVertical: 8,
  },
  back: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2e1a',
    paddingVertical: 8,
  },
  nextButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  nextPlaceholder: {
    minWidth: 64,
  },
});
