import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Keyboard, ScrollView,
} from 'react-native';
import WebView from 'react-native-webview';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { canSubmitBoundaryEdit } from '../../lib/roles';

type Route = RouteProp<RootStackParamList, 'SubmitBoundaryEdit'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'SubmitBoundaryEdit'>;

export default function SubmitBoundaryEditScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { habitatId } = route.params;
  const { role, loading: roleLoading } = useUserRole();

  const [habitatBoundary, setHabitatBoundary] = useState<any>(null);
  const [habitatName, setHabitatName] = useState('');
  const [proposedGeoJSON, setProposedGeoJSON] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loadingHabitat, setLoadingHabitat] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchHabitat = async () => {
      const { data, error } = await supabase
        .from('habitats')
        .select('name, habitat_code, boundary')
        .eq('id', habitatId)
        .single();

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setHabitatBoundary(data.boundary ?? null);
        setHabitatName(data.habitat_code ?? data.name ?? '');
      }
      setLoadingHabitat(false);
    };

    fetchHabitat();
  }, [habitatId]);

  const handleSubmit = async () => {
    if (!proposedGeoJSON) {
      Alert.alert('No Boundary Drawn', 'Please draw a revised boundary on the map.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Missing Reason', 'Please explain why this boundary should change.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('boundary_edits').insert({
      habitat_id: habitatId,
      user_id: user.id,
      proposed_boundary: proposedGeoJSON,
      description: reason.trim(),
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Submission Failed', error.message);
    } else {
      Alert.alert(
        'Submitted',
        'Your boundary edit has been submitted for verifier review.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  };

  const buildMapHTML = () => {
    const existingJSON = JSON.stringify(habitatBoundary);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://js.arcgis.com/4.29/esri/themes/dark/main.css">
  <script src="https://js.arcgis.com/4.29/"></script>
  <style>
    html, body, #viewDiv { margin: 0; padding: 0; width: 100%; height: 100%; background: #1a1a1a; }
    #drawBtn {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      padding: 8px 20px;
      border: none;
      border-radius: 20px;
      z-index: 99;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #hint {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: #fff;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      white-space: nowrap;
      z-index: 99;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="viewDiv"></div>
  <button id="drawBtn">✏ Draw Boundary</button>
  <div id="hint">Tap the button above to start drawing</div>
  <script>
    var existingBoundary = ${existingJSON};
    var sketchRef = null;

    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/Graphic",
      "esri/geometry/Polygon",
      "esri/layers/GraphicsLayer",
      "esri/widgets/Sketch"
    ], function(Map, MapView, Graphic, Polygon, GraphicsLayer, Sketch) {

      function mercatorToLngLat(x, y) {
        var lng = (x / 20037508.342) * 180;
        var lat = Math.atan(Math.exp((y / 20037508.342) * Math.PI)) * (360 / Math.PI) - 90;
        return [lng, lat];
      }

      var map = new Map({ basemap: "streets-night-vector" });

      var view = new MapView({
        container: "viewDiv",
        map: map,
        zoom: 12,
        center: [-118.25, 34.05]
      });

      var referenceLayer = new GraphicsLayer();
      var sketchLayer = new GraphicsLayer();
      map.addMany([referenceLayer, sketchLayer]);

      var existingRings = existingBoundary
        ? (existingBoundary.coordinates || existingBoundary.rings || null)
        : null;
      if (existingRings) {
        var existingPolygon = new Polygon({
          spatialReference: { wkid: 4326 },
          rings: existingRings
        });
        referenceLayer.add(new Graphic({
          geometry: existingPolygon,
          symbol: {
            type: "simple-fill",
            color: [200, 200, 200, 0.15],
            outline: { color: [200, 200, 200], width: 2, style: "dash" }
          }
        }));
        view.goTo(existingPolygon);
      }

      var sketch = new Sketch({
        layer: sketchLayer,
        view: view,
        visibleElements: { toolbar: false }
      });
      sketchRef = sketch;

      function sendGeoJSON(geometry) {
        var convertedRings = geometry.rings.map(function(ring) {
          return ring.map(function(pt) { return mercatorToLngLat(pt[0], pt[1]); });
        });
        var geojson = { type: "Polygon", coordinates: convertedRings };
        document.getElementById("hint").textContent = "✓ Boundary drawn — scroll down to submit";
        document.getElementById("drawBtn").textContent = "✏ Redraw";
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "sketch", geojson: geojson }));
      }

      sketch.on("create", function(event) {
        if (event.state === "complete") {
          sendGeoJSON(event.graphic.geometry);
        } else if (event.state === "active") {
          document.getElementById("hint").textContent = "Tap to add points • Double-tap to finish";
        }
      });

      document.getElementById("drawBtn").addEventListener("click", function() {
        sketchLayer.removeAll();
        sketch.create("polygon");
        document.getElementById("hint").textContent = "Tap to add points • Double-tap to finish";
      });
    });
  </script>
</body>
</html>`;
  };

  if (roleLoading || loadingHabitat) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!canSubmitBoundaryEdit(role)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedIcon}>🔒</Text>
        <Text style={styles.deniedTitle}>Contributor Role Required</Text>
        <Text style={styles.deniedSubtitle}>
          Only contributors and above can suggest boundary edits.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { Keyboard.dismiss(); navigation.goBack(); }}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Suggest Boundary Edit</Text>
        {habitatName ? <Text style={styles.subtitle}>{habitatName}</Text> : null}
      </View>

      {loadingHabitat ? (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator color="#4caf50" />
        </View>
      ) : (
        <WebView
          source={{ html: buildMapHTML() }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          onMessage={(event) => {
            try {
              const parsed = JSON.parse(event.nativeEvent.data);
              if (parsed.type === 'sketch') {
                setProposedGeoJSON(parsed.geojson);
              }
            } catch {
              // ignore non-JSON messages
            }
          }}
        />
      )}

      <ScrollView style={styles.formPanel} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.polygonStatus}>
          {proposedGeoJSON ? (
            <Text style={styles.polygonStatusDone}>✓ Boundary drawn</Text>
          ) : (
            <Text style={styles.polygonStatusPending}>Draw a revised polygon on the map above</Text>
          )}
        </View>

        <Text style={styles.label}>Reason for Change</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Explain why this boundary should be updated..."
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={4}
          value={reason}
          onChangeText={setReason}
          textAlignVertical="top"
        />

        <View style={styles.reviewNote}>
          <Text style={styles.reviewNoteText}>
            ⏳  The official boundary will not change until a verifier approves this edit.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitButtonText}>Submit Boundary Edit</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: '#1a2e1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  mapPlaceholder: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  map: {
    height: 280,
  },
  formPanel: {
    flex: 1,
    padding: 20,
  },
  polygonStatus: {
    paddingVertical: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  polygonStatusDone: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '700',
  },
  polygonStatusPending: {
    fontSize: 14,
    color: '#aaa',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    fontSize: 15,
    color: '#111',
    minHeight: 100,
    marginBottom: 16,
  },
  reviewNote: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  reviewNoteText: {
    fontSize: 13,
    color: '#7a6000',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f5f5f0',
  },
  deniedIcon: { fontSize: 48, marginBottom: 16 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e1a', marginBottom: 8 },
  deniedSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { fontSize: 15, color: '#4caf50', fontWeight: '600' },
});
