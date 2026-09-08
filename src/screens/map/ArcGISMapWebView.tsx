import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import { MapBasemapMode, MAP_BASEMAP_IDS } from '../../lib/mapBasemap';
import {
  ARCGIS_BASE,
  buildHTML,
  mapDataKey,
  MapCenterMode,
  Props,
  UserMapLocation,
} from './arcgisMapHtml';

export type { MapCenterMode, UserMapLocation, Props };

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
