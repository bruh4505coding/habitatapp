import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import { Habitat } from './WorldMapScreen';
import { MapBasemapMode, MAP_BASEMAP_IDS } from '../../lib/mapBasemap';

export type MapCenterMode = 'default' | 'user' | 'polygons';

export type UserMapLocation = {
  latitude: number;
  longitude: number;
};

interface Props {
  habitats: Habitat[];
  onHabitatSelect: (habitatId: string) => void;
  nestedInScrollView?: boolean;
  onInteractionChange?: (interacting: boolean) => void;
  centerMode?: MapCenterMode;
  userLocation?: UserMapLocation | null;
  /** Increment to re-run goTo even when coordinates did not change. */
  centerNonce?: number;
  /** Tap anywhere to choose a map center (for custom work area). */
  pickMode?: boolean;
  onMapPointSelect?: (point: UserMapLocation) => void;
  /** Streets (night) or satellite imagery. Switched without remounting. */
  basemapMode?: MapBasemapMode;
}

const ARCGIS_BASE = 'https://js.arcgis.com/';

function mapDataKey(
  habitats: Habitat[],
  centerMode: MapCenterMode,
  userLocation: UserMapLocation | null,
  nestedInScrollView: boolean,
  pickMode: boolean,
): string {
  // Habitats + center mode only — location updates use injectJavaScript so
  // we don't remount/reload ArcGIS for every Near me tap.
  return JSON.stringify({
    habitats: habitats.map((h) => ({ id: h.id, boundary: h.boundary, color: h.color })),
    centerMode,
    nestedInScrollView,
    hasUserLocation: Boolean(userLocation),
    pickMode,
  });
}

function buildHTML(
  habitats: Habitat[],
  centerMode: MapCenterMode,
  userLocation: UserMapLocation | null,
  nestedInScrollView: boolean,
  pickMode: boolean,
  basemapMode: MapBasemapMode,
): string {
  const habitatJSON = JSON.stringify(habitats);
  const userLocationJSON = JSON.stringify(userLocation);
  const basemapId = MAP_BASEMAP_IDS[basemapMode];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="${ARCGIS_BASE}4.29/esri/themes/dark/main.css">
  <style>
    html, body, #viewDiv { margin: 0; padding: 0; width: 100%; height: 100%; background: #2a2a2a; }
  </style>
</head>
<body>
  <div id="viewDiv"></div>
  <script>
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    }

    function startMap() {
      if (typeof require === 'undefined') {
        setTimeout(startMap, 50);
        return;
      }

      var habitatData = ${habitatJSON};
      var centerMode = ${JSON.stringify(centerMode)};
      var userLocation = ${userLocationJSON};
      var pickMode = ${JSON.stringify(pickMode)};
      var basemapId = ${JSON.stringify(basemapId)};

      require([
        "esri/Map",
        "esri/views/MapView",
        "esri/Graphic",
        "esri/geometry/Polygon",
        "esri/geometry/Point",
        "esri/layers/GraphicsLayer",
        "esri/Color"
      ], function(Map, MapView, Graphic, Polygon, Point, GraphicsLayer, Color) {

        var map = new Map({ basemap: basemapId });
        window.__map = map;
        var initialCenter = [-98, 38];
        var initialZoom = 5;
        if ((centerMode === "user" || pickMode) && userLocation
            && typeof userLocation.longitude === "number"
            && typeof userLocation.latitude === "number") {
          initialCenter = [userLocation.longitude, userLocation.latitude];
          initialZoom = 12;
        }

        var view = new MapView({
          container: "viewDiv",
          map: map,
          zoom: initialZoom,
          center: initialCenter
        });
        window.__mapView = view;

        var graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        var pickLayer = new GraphicsLayer();
        map.add(pickLayer);
        window.__pickLayer = pickLayer;

        habitatData.forEach(function(habitat) {
          try {
            if (!habitat.boundary || !habitat.boundary.coordinates) return;

            var hexColor = habitat.color || '#4caf50';
            var fillColor = new Color(hexColor);
            fillColor.a = 0.35;
            var outlineColor = new Color(hexColor);

            var polygon = new Polygon({
              spatialReference: { wkid: 4326 },
              rings: habitat.boundary.coordinates
            });

            graphicsLayer.add(new Graphic({
              geometry: polygon,
              symbol: {
                type: "simple-fill",
                color: fillColor,
                outline: { color: outlineColor, width: 2 }
              },
              attributes: {
                habitatId: habitat.id,
                name: habitat.name,
                habitatCode: habitat.habitat_code,
                habitatType: habitat.habitat_type,
              }
            }));
          } catch (e) {
            post('DEBUG:skip:' + habitat.id);
          }
        });

        view.when(function() {
          if (centerMode === "polygons" && graphicsLayer.graphics.length > 0) {
            view.goTo(
              graphicsLayer.graphics.toArray().map(function(g) { return g.geometry; }),
              { padding: 48 }
            ).catch(function() {});
            return;
          }
          if (centerMode === "user" && userLocation
              && typeof userLocation.longitude === "number"
              && typeof userLocation.latitude === "number") {
            var userPoint = new Point({
              longitude: userLocation.longitude,
              latitude: userLocation.latitude,
              spatialReference: { wkid: 4326 }
            });
            graphicsLayer.add(new Graphic({
              geometry: userPoint,
              symbol: {
                type: "simple-marker",
                color: "#2196f3",
                size: 12,
                outline: { color: "#ffffff", width: 2 }
              },
              attributes: { habitatId: null }
            }));
            view.goTo({
              target: userPoint,
              zoom: 12
            }).catch(function() {
              view.center = userPoint;
              view.zoom = 12;
            });
          }
        });

        function placePickMarker(lon, lat) {
          pickLayer.removeAll();
          pickLayer.add(new Graphic({
            geometry: new Point({
              longitude: lon,
              latitude: lat,
              spatialReference: { wkid: 4326 }
            }),
            symbol: {
              type: "simple-marker",
              color: "#ff9800",
              size: 14,
              outline: { color: "#ffffff", width: 2 }
            },
            attributes: { pick: true }
          }));
        }

        if (pickMode && userLocation
            && typeof userLocation.longitude === "number"
            && typeof userLocation.latitude === "number") {
          placePickMarker(userLocation.longitude, userLocation.latitude);
        }

        view.on("click", function(event) {
          if (pickMode) {
            var lon = event.mapPoint.longitude;
            var lat = event.mapPoint.latitude;
            if (typeof lon !== "number" || typeof lat !== "number") return;
            if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return;
            placePickMarker(lon, lat);
            post("MAP_POINT:" + lon + "," + lat);
            return;
          }

          view.hitTest(event).then(function(response) {
            var hit = response.results.find(function(r) {
              return r.type === "graphic"
                && r.graphic.attributes
                && r.graphic.attributes.habitatId;
            });
            if (hit) post(hit.graphic.attributes.habitatId);
          });
        });

        ${nestedInScrollView ? `
        view.on("pointer-down", function() { post("SCROLL_LOCK"); });
        view.on("pointer-up", function() { post("SCROLL_UNLOCK"); });
        ` : ''}

        post('DEBUG:ready');
      }, function(err) {
        post('DEBUG:error:' + (err && err.message ? err.message : String(err)));
      });
    }
  </script>
  <script src="${ARCGIS_BASE}4.29/" onload="startMap()"></script>
</body>
</html>`;
}

export default function ArcGISMapWebView({
  habitats,
  onHabitatSelect,
  nestedInScrollView = false,
  onInteractionChange,
  centerMode = 'default',
  userLocation = null,
  centerNonce = 0,
  pickMode = false,
  onMapPointSelect,
  basemapMode = 'streets',
}: Props) {
  const webRef = useRef<WebView>(null);
  const initialBasemapRef = useRef(basemapMode);

  const dataKey = mapDataKey(habitats, centerMode, userLocation, nestedInScrollView, pickMode);

  const source = useMemo(
    () => ({
      // Use the basemap at first mount so toggles don't remount / reset camera.
      html: buildHTML(
        habitats,
        centerMode,
        userLocation,
        nestedInScrollView,
        pickMode,
        initialBasemapRef.current,
      ),
      baseUrl: ARCGIS_BASE,
    }),
    [dataKey, userLocation?.latitude, userLocation?.longitude, pickMode],
  );

  // Swap basemap without remounting the WebView (keeps pan/zoom).
  useEffect(() => {
    initialBasemapRef.current = basemapMode;
    const basemapId = MAP_BASEMAP_IDS[basemapMode];
    const js = `
      (function() {
        var map = window.__map;
        if (!map) return;
        try { map.basemap = ${JSON.stringify(basemapId)}; } catch (e) {}
      })();
      true;
    `;
    const timer = setTimeout(() => {
      webRef.current?.injectJavaScript(js);
    }, 200);
    return () => clearTimeout(timer);
  }, [basemapMode]);

  // Force camera move after load / when the user taps Near me again.
  useEffect(() => {
    if (centerMode !== 'user' || !userLocation) return;

    const js = `
      (function() {
        var view = window.__mapView;
        if (!view) return;
        var lon = ${userLocation.longitude};
        var lat = ${userLocation.latitude};
        try {
          if (window.require) {
            require(["esri/geometry/Point"], function(Point) {
              var pt = new Point({ longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } });
              view.goTo({ target: pt, zoom: 12 }).catch(function() {
                view.center = pt;
                view.zoom = 12;
              });
            });
          } else {
            view.goTo({ center: [lon, lat], zoom: 12 }).catch(function() {});
          }
        } catch (e) {}
      })();
      true;
    `;
    const timer = setTimeout(() => {
      webRef.current?.injectJavaScript(js);
    }, 450);
    return () => clearTimeout(timer);
  }, [centerMode, userLocation?.latitude, userLocation?.longitude, centerNonce]);

  return (
    <WebView
      key={dataKey}
      ref={webRef}
      source={source}
      style={styles.webview}
      onContentProcessDidTerminate={() => webRef.current?.reload()}
      onMessage={(event) => {
        const msg = event.nativeEvent.data;
        if (msg.startsWith('DEBUG:')) {
          console.log('[Map]', msg);
          return;
        }
        if (nestedInScrollView) {
          if (msg === 'SCROLL_LOCK') { onInteractionChange?.(true); return; }
          if (msg === 'SCROLL_UNLOCK') { onInteractionChange?.(false); return; }
        }
        if (msg.startsWith('MAP_POINT:')) {
          const [, coords] = msg.split('MAP_POINT:');
          const [lonStr, latStr] = (coords ?? '').split(',');
          const longitude = Number(lonStr);
          const latitude = Number(latStr);
          if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            onMapPointSelect?.({ longitude, latitude });
          }
          return;
        }
        onHabitatSelect(msg);
      }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      nestedScrollEnabled={nestedInScrollView}
      scrollEnabled={false}
      bounces={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#2a2a2a',
  },
});
