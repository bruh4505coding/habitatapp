/**
 * Browser counterpart of ArcGISMapWebView.tsx.
 *
 * react-native-webview has no web implementation, so the same generated
 * document is hosted in an iframe instead. The bridge maps across directly:
 * injectJavaScript becomes a script appended to the iframe document, and
 * onMessage becomes a window "message" listener.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapBasemapMode, MAP_BASEMAP_IDS } from '../../lib/mapBasemap';
import {
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const initialBasemapRef = useRef(basemapMode);

  const dataKey = mapDataKey(habitats, centerMode, userLocation, nestedInScrollView, pickMode);

  const html = useMemo(
    () => buildHTML(
      habitats,
      centerMode,
      userLocation,
      nestedInScrollView,
      pickMode,
      initialBasemapRef.current,
    ),
    [dataKey, userLocation?.latitude, userLocation?.longitude, pickMode],
  );

  // Latest callbacks, so the message listener below is attached only once.
  const handlers = useRef({ onHabitatSelect, onInteractionChange, onMapPointSelect });
  handlers.current = { onHabitatSelect, onInteractionChange, onMapPointSelect };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only trust messages coming from our own iframe.
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const msg = typeof event.data === 'string' ? event.data : '';
      if (!msg) return;

      if (msg.startsWith('DEBUG:')) {
        console.log('[Map]', msg);
        return;
      }
      if (nestedInScrollView) {
        if (msg === 'SCROLL_LOCK') { handlers.current.onInteractionChange?.(true); return; }
        if (msg === 'SCROLL_UNLOCK') { handlers.current.onInteractionChange?.(false); return; }
      }
      if (msg.startsWith('MAP_POINT:')) {
        const [, coords] = msg.split('MAP_POINT:');
        const [lonStr, latStr] = (coords ?? '').split(',');
        const longitude = Number(lonStr);
        const latitude = Number(latStr);
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
          handlers.current.onMapPointSelect?.({ longitude, latitude });
        }
        return;
      }
      handlers.current.onHabitatSelect(msg);
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [nestedInScrollView]);

  /** Native's injectJavaScript equivalent: run a snippet inside the iframe. */
  function runInFrame(code: string): void {
    const frame = frameRef.current;
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!win || !doc?.body) return;
    try {
      const script = doc.createElement('script');
      script.text = code;
      doc.body.appendChild(script);
      doc.body.removeChild(script);
    } catch {
      // Cross-origin or torn-down frame — nothing to do.
    }
  }

  // Swap basemap without reloading the frame (keeps pan/zoom).
  useEffect(() => {
    initialBasemapRef.current = basemapMode;
    const basemapId = MAP_BASEMAP_IDS[basemapMode];
    const timer = setTimeout(() => {
      runInFrame(`
        (function() {
          var map = window.__map;
          if (!map) return;
          try { map.basemap = ${JSON.stringify(basemapId)}; } catch (e) {}
        })();
      `);
    }, 200);
    return () => clearTimeout(timer);
  }, [basemapMode]);

  // Force camera move after load / when the user taps Near me again.
  useEffect(() => {
    if (centerMode !== 'user' || !userLocation) return;

    const timer = setTimeout(() => {
      runInFrame(`
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
      `);
    }, 450);
    return () => clearTimeout(timer);
  }, [centerMode, userLocation?.latitude, userLocation?.longitude, centerNonce]);

  return (
    <View style={styles.container}>
      <iframe
        key={dataKey}
        ref={frameRef}
        srcDoc={html}
        title="Habitat map"
        // allow-same-origin lets runInFrame reach the document; the content is
        // ours (built by buildHTML), not third-party.
        sandbox="allow-scripts allow-same-origin"
        allow="geolocation"
        style={iframeStyle}
      />
    </View>
  );
}

const iframeStyle: React.CSSProperties = {
  border: 'none',
  width: '100%',
  height: '100%',
  display: 'block',
  backgroundColor: '#2a2a2a',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2a2a',
  },
});
