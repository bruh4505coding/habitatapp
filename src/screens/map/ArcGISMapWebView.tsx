import React from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import { Habitat } from './WorldMapScreen';

interface Props {
  habitats: Habitat[];
  onHabitatSelect: (habitatId: string) => void;
}

export default function ArcGISMapWebView({ habitats, onHabitatSelect }: Props) {
  const buildHTML = () => {
    const habitatJSON = JSON.stringify(habitats);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://js.arcgis.com/4.29/esri/themes/dark/main.css">
  <script src="https://js.arcgis.com/4.29/"></script>
  <style>
    html, body, #viewDiv { margin: 0; padding: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="viewDiv"></div>
  <script>
    var habitatData = ${habitatJSON};

    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/Graphic",
      "esri/geometry/Polygon",
      "esri/layers/GraphicsLayer",
      "esri/Color"
    ], function(Map, MapView, Graphic, Polygon, GraphicsLayer, Color) {

      var map = new Map({ basemap: "streets-night-vector" });

      var view = new MapView({
        container: "viewDiv",
        map: map,
        zoom: 5,
        center: [-98, 38]
      });

      var graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      habitatData.forEach(function(habitat) {
        if (!habitat.boundary) return;

        var hexColor = habitat.color || '#4caf50';
        var fillColor = new Color(hexColor);
        fillColor.a = 0.35;
        var outlineColor = new Color(hexColor);

        var fillSymbol = {
          type: "simple-fill",
          color: fillColor,
          outline: { color: outlineColor, width: 2 }
        };

        var polygon = new Polygon({
          spatialReference: { wkid: 4326 },
          rings: habitat.boundary.coordinates
        });

        var graphic = new Graphic({
          geometry: polygon,
          symbol: fillSymbol,
          attributes: {
            habitatId: habitat.id,
            name: habitat.name,
            habitatCode: habitat.habitat_code,
            habitatType: habitat.habitat_type,
          }
        });

        graphicsLayer.add(graphic);
      });

      view.on("click", function(event) {
        view.hitTest(event).then(function(response) {
          var results = response.results.filter(function(r) {
            return r.type === "graphic" && r.graphic.attributes && r.graphic.attributes.habitatId;
          });
          if (results.length > 0) {
            var habitatId = results[0].graphic.attributes.habitatId;
            window.ReactNativeWebView.postMessage(habitatId);
          }
        });
      });
    });
  </script>
</body>
</html>`;
  };

  return (
    <WebView
      source={{ html: buildHTML() }}
      style={styles.webview}
      onMessage={(event) => {
        const msg = event.nativeEvent.data;
        if (msg.startsWith('DEBUG:')) {
          console.log('[WebView]', msg);
          return;
        }
        onHabitatSelect(msg);
      }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});
