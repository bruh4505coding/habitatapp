import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useGroupMembership } from '../../hooks/useGroupMembership';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  groupId: string;
  navigation: Nav;
  children: React.ReactNode;
};

export default function GroupMembersOnlyGate({ groupId, navigation, children }: Props) {
  const { isMember, loading } = useGroupMembership(groupId);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!isMember) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedTitle}>Members only</Text>
        <Text style={styles.deniedSub}>
          You must be an active member of this steward group to access this area.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f0f4f0',
  },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
