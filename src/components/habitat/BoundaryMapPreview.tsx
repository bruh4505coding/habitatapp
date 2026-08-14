import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import ArcGISMapWebView from '../../screens/map/ArcGISMapWebView';
import { Habitat } from '../../screens/map/WorldMapScreen';

type Props = {
  habitats: Habitat[];
  height?: number;
  onScrollLockChange?: (locked: boolean) => void;
  nestedInScrollView?: boolean;
};

function boundaryKey(habitats: Habitat[]): string {
  return habitats.map((h) => `${h.id}:${JSON.stringify(h.boundary)}`).join('|');
}

function BoundaryMapPreview({
  habitats,
  height = 460,
  onScrollLockChange,
  nestedInScrollView = true,
}: Props) {
  const stableHabitats = useMemo(
    () => habitats,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boundaryKey(habitats)],
  );

  return (
    <View style={[styles.container, { height }]} collapsable={false}>
      <ArcGISMapWebView
        habitats={stableHabitats}
        onHabitatSelect={() => {}}
        nestedInScrollView={nestedInScrollView}
        onInteractionChange={nestedInScrollView ? onScrollLockChange : undefined}
        centerMode="polygons"
      />
    </View>
  );
}

export default memo(BoundaryMapPreview, (prev, next) => (
  boundaryKey(prev.habitats) === boundaryKey(next.habitats)
  && prev.height === next.height
  && prev.nestedInScrollView === next.nestedInScrollView
));

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#1a2e1a',
  },
});
