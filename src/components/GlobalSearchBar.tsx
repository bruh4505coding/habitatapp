import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type HabitatResult = {
  kind: 'habitat';
  id: string;
  name: string;
  habitat_code: string | null;
  habitat_type: string | null;
  region: string | null;
};

type StewardGroupResult = {
  kind: 'group';
  id: string;
  name: string;
  slug: string;
  region: string | null;
};

type SearchResult = HabitatResult | StewardGroupResult;

type Anchor = {
  top: number;
  left: number;
  width: number;
};

type Props = {
  /** Called on every keystroke so the parent can also filter (e.g. map polygons) */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  /** Light style for use on dark backgrounds (WorldMap); dark style otherwise */
  variant?: 'light' | 'dark';
  /** Use full width instead of flex:1 (for screens without a side-by-side layout) */
  fullWidth?: boolean;
};

const DEBOUNCE_MS = 300;
const DROPDOWN_MAX_HEIGHT = 320;

function sanitizeSearchTerm(text: string): string {
  return text.replace(/[%_,]/g, '').trim();
}

export default function GlobalSearchBar({
  onQueryChange,
  placeholder = 'Search habitats & steward groups...',
  variant = 'light',
  fullWidth = false,
}: Props) {
  const navigation = useNavigation<Nav>();
  const wrapperRef = useRef<View>(null);
  const [query, setQuery] = useState('');
  const [habitatResults, setHabitatResults] = useState<HabitatResult[]>([]);
  const [groupResults, setGroupResults] = useState<StewardGroupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>({ top: 0, left: 0, width: Dimensions.get('window').width - 40 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAnchor = useCallback(() => {
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + 4, left: x, width: width || Dimensions.get('window').width - 40 });
    });
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const term = sanitizeSearchTerm(text);
    if (!term) {
      setHabitatResults([]);
      setGroupResults([]);
      setShowDropdown(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const pattern = `%${term}%`;

    const [habitatRes, groupRes] = await Promise.all([
      supabase
        .from('habitats')
        .select('id, name, habitat_code, habitat_type, region')
        .or(
          `name.ilike.${pattern},habitat_code.ilike.${pattern},habitat_type.ilike.${pattern},region.ilike.${pattern}`
        )
        .limit(8),
      supabase
        .from('steward_groups')
        .select('id, name, slug, region')
        .eq('is_public', true)
        .eq('status', 'active')
        .or(`name.ilike.${pattern},slug.ilike.${pattern},region.ilike.${pattern},mission.ilike.${pattern}`)
        .limit(8),
    ]);

    setHabitatResults(
      (habitatRes.error ? [] : habitatRes.data ?? []).map((item) => ({
        kind: 'habitat' as const,
        ...item,
      })),
    );
    setGroupResults(
      (groupRes.error ? [] : groupRes.data ?? []).map((item) => ({
        kind: 'group' as const,
        ...item,
      })),
    );
    setShowDropdown(true);
    setSearching(false);
    updateAnchor();
  }, [updateAnchor]);

  useEffect(() => {
    onQueryChange?.(query);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch, onQueryChange]);

  useEffect(() => {
    if (showDropdown) {
      updateAnchor();
    }
  }, [showDropdown, updateAnchor]);

  const handleSelect = (item: SearchResult) => {
    setQuery('');
    setHabitatResults([]);
    setGroupResults([]);
    setShowDropdown(false);
    Keyboard.dismiss();
    if (item.kind === 'habitat') {
      navigation.navigate('HabitatDetail', { habitatId: item.id });
    } else {
      navigation.navigate('StewardGroup', { groupId: item.id });
    }
  };

  const handleClear = () => {
    setQuery('');
    setHabitatResults([]);
    setGroupResults([]);
    setShowDropdown(false);
    onQueryChange?.('');
  };

  const closeDropdown = () => {
    setShowDropdown(false);
  };

  const isLight = variant === 'light';
  const hasResults = habitatResults.length > 0 || groupResults.length > 0;

  const renderSection = (title: string, items: SearchResult[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
        {items.map((item, index) => (
          <View key={`${item.kind}-${item.id}`}>
            {index > 0 && <View style={styles.separator} />}
            <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
              {item.kind === 'habitat' ? (
                <>
                  <Text style={styles.resultName}>{item.name}</Text>
                  {(item.habitat_code || item.habitat_type || item.region) && (
                    <Text style={styles.resultMeta}>
                      {[item.habitat_code, item.habitat_type, item.region].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultMeta}>
                    Steward group · {[item.slug, item.region].filter(Boolean).join(' · ')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </>
    );
  };

  const dropdownContent = (
    <View style={styles.dropdown}>
      {!hasResults ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No habitats or steward groups found</Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: DROPDOWN_MAX_HEIGHT }}
          nestedScrollEnabled
        >
          {renderSection('Habitats', habitatResults)}
          {habitatResults.length > 0 && groupResults.length > 0 ? (
            <View style={styles.sectionDivider} />
          ) : null}
          {renderSection('Steward Groups', groupResults)}
        </ScrollView>
      )}
    </View>
  );

  return (
    <>
      <View
        ref={wrapperRef}
        style={[styles.wrapper, fullWidth && styles.wrapperFullWidth]}
        onLayout={updateAnchor}
      >
        <View style={[styles.inputRow, isLight ? styles.inputLight : styles.inputDark]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.input, { color: isLight ? '#111' : '#fff' }]}
            placeholder={placeholder}
            placeholderTextColor={isLight ? '#888' : '#aaa'}
            value={query}
            onChangeText={setQuery}
            onFocus={updateAnchor}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color="#4caf50" style={styles.spinner} />}
          {!searching && query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {!fullWidth && showDropdown && (
          <View style={styles.inlineDropdown}>
            {dropdownContent}
          </View>
        )}
      </View>

      {fullWidth && (
        <Modal
          visible={showDropdown}
          transparent
          animationType="fade"
          onRequestClose={closeDropdown}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDropdown} />
            <View
              style={[
                styles.modalDropdown,
                { top: anchor.top, left: anchor.left, width: anchor.width },
              ]}
            >
              {dropdownContent}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 100,
  },
  wrapperFullWidth: {
    flex: undefined,
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputDark: {
    backgroundColor: '#2a3d2a',
    borderWidth: 1,
    borderColor: '#3a5a3a',
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  spinner: {
    marginLeft: 6,
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
  clearText: {
    fontSize: 13,
    color: '#888',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
    overflow: 'hidden',
  },
  inlineDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: DROPDOWN_MAX_HEIGHT,
    zIndex: 200,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  modalDropdown: {
    position: 'absolute',
    zIndex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#f8f8f5',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e8e8e8',
  },
  emptyRow: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  resultMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 14,
  },
});
