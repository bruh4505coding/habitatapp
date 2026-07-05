import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, Keyboard,
  useWindowDimensions,
} from 'react-native';
import WebView from 'react-native-webview';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { canReviewSubmissions, isUserRole } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'ReviewSubmission'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'ReviewSubmission'>;

type SubmissionData = {
  id: string;
  type: 'contribution' | 'boundary_edit';
  habitatId: string;
  habitatName: string;
  habitatCode: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
  // contribution-specific
  contributionType?: string;
  title?: string;
  description?: string;
  inatLink?: string;
  // boundary edit-specific
  proposedBoundary?: any;
  currentBoundary?: any;
};

export default function ReviewSubmissionScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { submissionId, type } = route.params;

  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    const fetchSubmission = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!canReviewSubmissions(isUserRole(profile?.role) ? profile.role : null)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (type === 'contribution') {
        const { data: row, error } = await supabase
          .from('contributions')
          .select('id, type, title, description, inaturalist_link, status, created_at, habitat_id, habitats(name, habitat_code), profiles!contributions_user_id_fkey(username)')
          .eq('id', submissionId)
          .single();

        if (error || !row) { Alert.alert('Error', error?.message ?? 'Not found'); setLoading(false); return; }

        setData({
          id: row.id,
          type: 'contribution',
          habitatId: row.habitat_id,
          habitatName: (row.habitats as any)?.name ?? '—',
          habitatCode: (row.habitats as any)?.habitat_code ?? '—',
          submittedBy: (row.profiles as any)?.username ?? 'Unknown',
          submittedAt: new Date(row.created_at).toLocaleDateString(),
          status: row.status,
          contributionType: row.type,
          title: row.title,
          description: row.description,
          inatLink: row.inaturalist_link,
        });
      } else {
        const { data: row, error } = await supabase
          .from('boundary_edits')
          .select('id, description, proposed_boundary, status, created_at, habitat_id, habitats(name, habitat_code, boundary), profiles!boundary_edits_user_id_fkey(username)')
          .eq('id', submissionId)
          .single();

        if (error || !row) { Alert.alert('Error', error?.message ?? 'Not found'); setLoading(false); return; }

        setData({
          id: row.id,
          type: 'boundary_edit',
          habitatId: row.habitat_id,
          habitatName: (row.habitats as any)?.name ?? '—',
          habitatCode: (row.habitats as any)?.habitat_code ?? '—',
          submittedBy: (row.profiles as any)?.username ?? 'Unknown',
          submittedAt: new Date(row.created_at).toLocaleDateString(),
          status: row.status,
          description: row.description,
          proposedBoundary: row.proposed_boundary,
          currentBoundary: (row.habitats as any)?.boundary ?? null,
        });
      }

      setLoading(false);
    };

    fetchSubmission();
  }, [submissionId, type]);

  const applyDecision = async (decision: 'approved' | 'rejected' | 'changes_requested') => {
    if (!data) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('Error', 'Not logged in.'); return; }

    setSubmitting(true);

    if (data.type === 'contribution') {
      const { error } = await supabase
        .from('contributions')
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote.trim() || null,
        })
        .eq('id', data.id);

      setSubmitting(false);

      if (error) { Alert.alert('Error', error.message); return; }

      Alert.alert('Done', `Contribution marked as ${decision}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

    } else {
      // Boundary edit approval requires also updating the habitat polygon
      if (decision === 'approved') {
        Alert.alert(
          'Confirm Approval',
          `This will permanently replace the official boundary of "${data.habitatName}" with the proposed polygon. This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSubmitting(false) },
            {
              text: 'Approve',
              style: 'destructive',
              onPress: async () => {
                const [editUpdate, habitatUpdate] = await Promise.all([
                  supabase
                    .from('boundary_edits')
                    .update({
                      status: 'approved',
                      reviewed_by: user.id,
                      reviewed_at: new Date().toISOString(),
                      review_note: reviewNote.trim() || null,
                    })
                    .eq('id', data.id),

                  supabase
                    .from('habitats')
                    .update({
                      boundary: data.proposedBoundary,
                      last_verified_by: user.id,
                      last_verified_at: new Date().toISOString(),
                    })
                    .eq('id', data.habitatId),
                ]);

                setSubmitting(false);

                if (editUpdate.error || habitatUpdate.error) {
                  Alert.alert('Error', editUpdate.error?.message ?? habitatUpdate.error?.message ?? 'Unknown error');
                  return;
                }

                Alert.alert('Approved', 'The habitat boundary has been updated.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              },
            },
          ],
        );
      } else {
        const { error } = await supabase
          .from('boundary_edits')
          .update({
            status: decision,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_note: reviewNote.trim() || null,
          })
          .eq('id', data.id);

        setSubmitting(false);

        if (error) { Alert.alert('Error', error.message); return; }

        Alert.alert('Done', `Boundary edit marked as ${decision}.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    }
  };

  const buildComparisonMapHTML = (currentBoundary: any, proposedBoundary: any) => {
    const currentJSON = JSON.stringify(currentBoundary);
    const proposedJSON = JSON.stringify(proposedBoundary);
    return `
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://js.arcgis.com/4.29/esri/themes/dark/main.css">
  <script src="https://js.arcgis.com/4.29/"></script>
  <style>
    html,body,#viewDiv{margin:0;padding:0;width:100%;height:100%;background:#1a1a1a;}
    .legend{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.75);border-radius:8px;padding:8px 12px;z-index:99;pointer-events:none;}
    .lr{display:flex;align-items:center;margin-bottom:4px;}
    .lb{width:14px;height:14px;border-radius:2px;margin-right:8px;}
    .ll{color:#fff;font-size:11px;}
  </style>
</head>
<body>
  <div id="viewDiv"></div>
  <div class="legend">
    <div class="lr"><div class="lb" style="background:rgba(200,200,200,0.4);border:2px dashed #aaa;"></div><span class="ll">Current</span></div>
    <div class="lr"><div class="lb" style="background:rgba(255,152,0,0.5);border:2px solid #ff9800;"></div><span class="ll">Proposed</span></div>
  </div>
  <script>
    var cur = ${currentJSON};
    var prop = ${proposedJSON};
    require(["esri/Map","esri/views/MapView","esri/Graphic","esri/geometry/Polygon","esri/layers/GraphicsLayer"],
    function(Map,MapView,Graphic,Polygon,GraphicsLayer){
      var map = new Map({basemap:"streets-night-vector"});
      var view = new MapView({container:"viewDiv",map:map,zoom:12,center:[-118.25,34.05]});
      var layer = new GraphicsLayer();
      map.add(layer);
      var targets = [];
      var curRings = cur ? (cur.coordinates||cur.rings||null) : null;
      if(curRings){
        var cp = new Polygon({spatialReference:{wkid:4326},rings:curRings});
        layer.add(new Graphic({geometry:cp,symbol:{type:"simple-fill",color:[200,200,200,0.2],outline:{color:[180,180,180],width:2,style:"dash"}}}));
        targets.push(cp);
      }
      var propRings = prop ? (prop.coordinates||prop.rings||null) : null;
      if(propRings){
        var pp = new Polygon({spatialReference:{wkid:4326},rings:propRings});
        layer.add(new Graphic({geometry:pp,symbol:{type:"simple-fill",color:[255,152,0,0.35],outline:{color:[255,152,0],width:2.5}}}));
        targets.push(pp);
      }
      if(targets.length>0) view.goTo(targets);
    });
  </script>
</body></html>`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Access Restricted</Text>
        <Text style={styles.deniedSubtitle}>
          Only verifiers and admins can review submissions.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  const isAlreadyReviewed = data.status !== 'pending';

  const detailsPanel = (
    <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {isAlreadyReviewed && (
        <View style={[styles.statusBanner,
          data.status === 'approved' ? styles.bannerApproved :
          data.status === 'rejected' ? styles.bannerRejected : styles.bannerChanges
        ]}>
          <Text style={styles.statusBannerText}>
            {data.status === 'approved' ? '✓ Already Approved' :
             data.status === 'rejected' ? '✗ Already Rejected' : '↩ Changes Requested'}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submission Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {data.type === 'boundary_edit' ? 'Boundary Edit' : data.contributionType ?? 'Contribution'}
            </Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Habitat</Text>
          <Text style={styles.detailValue}>{data.habitatCode} — {data.habitatName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Submitted by</Text>
          <Text style={styles.detailValue}>{data.submittedBy}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{data.submittedAt}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content</Text>
        {data.title ? <Text style={styles.contentTitle}>{data.title}</Text> : null}
        {data.description
          ? <Text style={styles.contentBody}>{data.description}</Text>
          : <Text style={styles.contentEmpty}>No description provided.</Text>}
        {data.inatLink ? (
          <View style={styles.inatRow}>
            <Text style={styles.inatLabel}>iNaturalist</Text>
            <Text style={styles.inatLink}>{data.inatLink}</Text>
          </View>
        ) : null}
        {data.type === 'boundary_edit' && (
          <View style={styles.boundaryNote}>
            <Text style={styles.boundaryNoteText}>
              Grey dashed = current boundary.  Orange = proposed.{'\n'}
              Approving will permanently replace the current boundary.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Note (optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Leave a note for the submitter..."
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={3}
          value={reviewNote}
          onChangeText={setReviewNote}
          textAlignVertical="top"
          editable={!isAlreadyReviewed}
        />
      </View>

      {!isAlreadyReviewed && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, submitting && styles.btnDisabled]}
            onPress={() => applyDecision('approved')}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>✓  Approve</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.changesBtn, submitting && styles.btnDisabled]}
            onPress={() => applyDecision('changes_requested')}
            disabled={submitting}
          >
            <Text style={styles.actionBtnText}>↩  Request Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, submitting && styles.btnDisabled]}
            onPress={() => applyDecision('rejected')}
            disabled={submitting}
          >
            <Text style={styles.actionBtnText}>✗  Reject</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  if (data.type === 'boundary_edit') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Boundary Edit</Text>
          <Text style={styles.headerSub}>{data.habitatCode} · {data.submittedBy}</Text>
        </View>
        <WebView
          source={{ html: buildComparisonMapHTML(data.currentBoundary, data.proposedBoundary) }}
          style={{ height: windowHeight * 0.45 }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
        {detailsPanel}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Contribution</Text>
        <Text style={styles.headerSub}>{data.habitatCode} · {data.submittedBy}</Text>
      </View>
      {detailsPanel}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 6 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  panel: { flex: 1, padding: 16 },

  statusBanner: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerApproved: { backgroundColor: '#e8f5e9' },
  bannerRejected: { backgroundColor: '#fbe9e7' },
  bannerChanges: { backgroundColor: '#fff8e1' },
  statusBannerText: { fontSize: 14, fontWeight: '700', color: '#333' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#333', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  typeBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '700' },

  contentTitle: { fontSize: 17, fontWeight: '700', color: '#1a2e1a', marginBottom: 8 },
  contentBody: { fontSize: 14, color: '#444', lineHeight: 20 },
  contentEmpty: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  inatRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inatLabel: { fontSize: 11, color: '#aaa', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  inatLink: { fontSize: 13, color: '#1565c0' },
  boundaryNote: {
    marginTop: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  boundaryNoteText: { fontSize: 13, color: '#7a6000', lineHeight: 18 },

  textArea: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 14,
    color: '#111',
    minHeight: 80,
  },

  actions: { gap: 10, marginBottom: 8 },
  actionBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtn: { backgroundColor: '#4caf50' },
  changesBtn: { backgroundColor: '#f57c00' },
  rejectBtn: { backgroundColor: '#e53935' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deniedIcon: { fontSize: 48, marginBottom: 16 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
