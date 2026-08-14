export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type KmlParseResult =
  | { ok: true; polygon: GeoJsonPolygon; pointCount: number }
  | { ok: false; error: string };

function parseCoordinatePairs(raw: string): number[][] {
  const pairs: number[][] = [];
  const tokens = raw.trim().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const parts = token.split(',').map((part) => Number(part.trim()));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) continue;
    pairs.push([parts[0], parts[1]]);
  }

  return pairs;
}

function ringFromPairs(pairs: number[][]): number[][] | null {
  if (pairs.length < 3) return null;

  const ring = [...pairs];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return ring.length >= 4 ? ring : null;
}

function extractCoordinateBlocks(kml: string): string[] {
  const blocks: string[] = [];
  const regex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match = regex.exec(kml);
  while (match) {
    blocks.push(match[1]);
    match = regex.exec(kml);
  }
  return blocks;
}

export function parseKmlToPolygon(kmlText: string): KmlParseResult {
  if (!kmlText.trim()) {
    return { ok: false, error: 'The KML file is empty.' };
  }

  const blocks = extractCoordinateBlocks(kmlText);
  if (blocks.length === 0) {
    const hasDocument = /<Document[\s>]/i.test(kmlText) || /<Placemark[\s>]/i.test(kmlText);
    if (hasDocument) {
      return {
        ok: false,
        error:
          'This KML has a name but no boundary coordinates. In Google Earth, open Projects, '
          + 'click ⋮ on your polygon (not the project folder), and choose "Export as KML file". '
          + 'The file should contain a <coordinates> block with lat/lng values.',
      };
    }
    return { ok: false, error: 'No coordinates found in this KML file.' };
  }

  for (const block of blocks) {
    const pairs = parseCoordinatePairs(block);
    const ring = ringFromPairs(pairs);
    if (ring) {
      return {
        ok: true,
        polygon: { type: 'Polygon', coordinates: [ring] },
        pointCount: ring.length,
      };
    }
  }

  return {
    ok: false,
    error: 'Could not build a valid polygon from the KML. Export a single closed polygon boundary.',
  };
}

/** Normalize GeoJSON or map boundary jsonb into ArcGIS polygon rings. */
export function boundaryRingsForMap(boundary: unknown): number[][][] | null {
  if (!boundary || typeof boundary !== 'object') return null;

  const coords = (boundary as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;

  if (Array.isArray(coords[0]?.[0])) {
    return coords as number[][][];
  }

  return null;
}

/** Format expected by ArcGIS map WebView (coordinates rings only). */
export function polygonToMapBoundary(polygon: GeoJsonPolygon): { coordinates: number[][][] } {
  return { coordinates: polygon.coordinates };
}
