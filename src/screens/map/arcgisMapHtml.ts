/**
 * Map HTML + shared types for the ArcGIS view.
 *
 * Platform-neutral on purpose: ArcGISMapWebView.tsx (native, react-native-webview)
 * and ArcGISMapWebView.web.tsx (browser, iframe) both build their document from
 * here, so the map behaviour stays in one place.
 *
 * The generated page talks to its host by posting strings — habitat id,
 * "MAP_POINT:<lon>,<lat>", "SCROLL_LOCK"/"SCROLL_UNLOCK", or "DEBUG:*".
 * On native that is window.ReactNativeWebView.postMessage; on web the same
 * payload goes through window.parent.postMessage.
 */
import { Habitat } from './WorldMapScreen';
import { MapBasemapMode, MAP_BASEMAP_IDS } from '../../lib/mapBasemap';

export type MapCenterMode = 'default' | 'user' | 'polygons';

export type UserMapLocation = {
  latitude: number;
  longitude: number;
};

export interface Props {
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

export const ARCGIS_BASE = 'https://js.arcgis.com/';

export function mapDataKey(
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

export function buildHTML(
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
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); return; }
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
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

