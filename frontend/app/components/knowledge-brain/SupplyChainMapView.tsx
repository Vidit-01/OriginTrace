'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import Mapbox, {
  FullscreenControl,
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  ScaleControl,
  Source,
  type MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { getLngLatForSupplyNode } from './country-centroids';
import { tierAccent, type SupplyNodeData } from './supply-chain-data';

export type MapPathHighlight = {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
};

export type SupplyChainMapViewProps = {
  nodes: Node<SupplyNodeData>[];
  edges: Edge[];
  rootId: string;
  hoveredId: string | null;
  selectedId: string | null;
  query: string;
  pathHighlight: MapPathHighlight | null;
  onHoverNode: (id: string | null) => void;
  onSelectNode: (id: string) => void;
};

/** Night navigation style — roads & land read clearly; pairs with fog + terrain. */
const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

function useMapToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
}

function SupplyChainMapViewInner({
  nodes,
  edges,
  rootId,
  hoveredId,
  selectedId,
  query,
  pathHighlight,
  onHoverNode,
  onSelectNode,
}: SupplyChainMapViewProps) {
  const token = useMapToken();
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);

  const posById = useMemo(() => {
    const m = new Map<string, { lng: number; lat: number }>();
    for (const n of nodes) {
      const hasBackendCoords =
        Number.isFinite(n.data.latitude) && Number.isFinite(n.data.longitude);
      if (hasBackendCoords) {
        m.set(n.id, { lat: Number(n.data.latitude), lng: Number(n.data.longitude) });
      } else {
        m.set(n.id, getLngLatForSupplyNode(n.data.country, n.id));
      }
    }
    return m;
  }, [nodes]);

  const tierById = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, n.data.tier);
    return m;
  }, [nodes]);

  const initialBounds = useMemo(() => {
    const pts = [...posById.values()];
    if (pts.length === 0) {
      return [
        [-170, -55],
        [170, 70],
      ] as [[number, number], [number, number]];
    }
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    const padX = Math.max(10, (Math.max(...lngs) - Math.min(...lngs)) * 0.14);
    const padY = Math.max(8, (Math.max(...lats) - Math.min(...lats)) * 0.18);
    return [
      [Math.min(...lngs) - padX, Math.min(...lats) - padY],
      [Math.max(...lngs) + padX, Math.max(...lats) + padY],
    ] as [[number, number], [number, number]];
  }, [posById]);

  /** More nodes → allow zooming in closer when fitting bounds / flying to a marker. */
  const dynamicMaxZoom = useMemo(
    () => Math.min(6, 3.5 + Math.min(nodes.length * 0.04, 2)),
    [nodes.length]
  );

  const edgeGeoJson = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = !!hoveredId && pathHighlight;
    const hiE = pathHighlight?.edgeIds;

    type LineFeature = {
      type: 'Feature';
      id: string;
      properties: { color: string; opacity: number; lineWidth: number };
      geometry: { type: 'LineString'; coordinates: number[][] };
    };

    const raw = edges.map((e): LineFeature | null => {
      const p0 = posById.get(String(e.source));
      const p1 = posById.get(String(e.target));
      if (!p0 || !p1) return null;
      const targetTier = tierById.get(String(e.target)) ?? 1;
      const color = tierAccent(targetTier);

      const n = nodes.find((x) => x.id === e.target);
      const hay = n
        ? [n.data.label, n.data.country, n.data.hsnCode, n.data.commodity, n.data.about]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        : '';
      const searchDim = q.length > 0 && !hay.includes(q);

      let opacity: number;
      let lineWidth: number;
      if (searchDim) {
        opacity = 0.06;
        lineWidth = 0.6;
      } else if (!active) {
        opacity = 0.72;
        lineWidth = 1.65;
      } else if (hiE?.has(e.id)) {
        opacity = 0.95;
        lineWidth = 3.4;
      } else {
        opacity = 0.1;
        lineWidth = 0.9;
      }

      return {
        type: 'Feature' as const,
        id: e.id,
        properties: { color, opacity, lineWidth },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [p0.lng, p0.lat],
            [p1.lng, p1.lat],
          ],
        },
      };
    });

    const features = raw.filter((f): f is LineFeature => f !== null);

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [edges, nodes, posById, tierById, hoveredId, pathHighlight, query]);

  const flyToNode = useCallback(
    (id: string) => {
      const p = posById.get(id);
      const map = mapRef.current?.getMap();
      if (!p || !map) return;
      const tier = tierById.get(id) ?? 0;
      const zoom = Math.min(dynamicMaxZoom, 2.75 + tier * 0.24 + Math.min(nodes.length * 0.02, 0.6));
      map.stop();
      map.flyTo({
        center: [p.lng, p.lat],
        zoom,
        duration: 900,
        curve: 1.35,
        essential: true,
      });
    },
    [posById, tierById, dynamicMaxZoom, nodes.length]
  );

  useEffect(() => {
    if (!mapReady || !selectedId) return;
    flyToNode(selectedId);
  }, [mapReady, selectedId, flyToNode]);

  const onMapLoad = useCallback(() => {
    setMapReady(true);
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.resize();
    try {
      map.fitBounds(initialBounds, {
        padding: 64,
        maxZoom: Math.min(dynamicMaxZoom, 5.2),
        duration: 0,
      });
    } catch {
      /* ignore */
    }

    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.18 });
    } catch {
      /* terrain optional if style/token limits */
    }

    try {
      map.setLight({
        anchor: 'viewport',
        color: '#dbeafe',
        intensity: 0.45,
        position: [1.8, 210, 45],
      });
    } catch {
      /* ignore */
    }
  }, [initialBounds, dynamicMaxZoom]);

  const sortedMarkers = useMemo(() => {
    const sel = selectedId;
    const withSel = nodes.filter((n) => n.id === sel);
    const rest = nodes.filter((n) => n.id !== sel);
    return [...rest, ...withSel];
  }, [nodes, selectedId]);

  if (!token) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#06080c] px-6 text-center">
        <p className="text-sm font-medium text-zinc-300">Mapbox token missing</p>
        <p className="max-w-md text-xs leading-relaxed text-zinc-500">
          Set <span className="font-mono text-zinc-400">MAPBOX_API_KEY</span> in{' '}
          <span className="font-mono text-zinc-400">frontend/.env</span>. It is
          forwarded to the browser as{' '}
          <span className="font-mono text-zinc-400">NEXT_PUBLIC_MAPBOX_TOKEN</span>{' '}
          via <span className="font-mono text-zinc-400">next.config.ts</span>, then
          restart <span className="font-mono text-zinc-400">next dev</span>.
        </p>
      </div>
    );
  }

  const ctrlChrome: CSSProperties = {
    backgroundColor: 'rgba(8, 11, 18, 0.94)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
  };

  return (
    <div className="synergy-map relative h-full w-full min-h-0 bg-[#06080c]">
      <Mapbox
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        attributionControl
        reuseMaps
        projection="globe"
        fog={{
          color: 'rgb(12, 22, 42)',
          'high-color': 'rgb(56, 128, 242)',
          'horizon-blend': 0.12,
          'space-color': 'rgb(6, 10, 22)',
          'star-intensity': 0.1,
        }}
        initialViewState={{
          bounds: initialBounds,
          fitBoundsOptions: {
            padding: 72,
            maxZoom: Math.min(dynamicMaxZoom, 5.2),
          },
        }}
        style={{ width: '100%', height: '100%' }}
        dragRotate
        pitchWithRotate
        maxPitch={72}
        minPitch={0}
        onLoad={onMapLoad}
        onClick={() => onHoverNode(null)}
      >
        <GeolocateControl
          position="top-left"
          trackUserLocation
          style={{
            ...ctrlChrome,
            marginTop: '52px',
            marginLeft: '12px',
          }}
        />
        <ScaleControl
          position="bottom-left"
          unit="metric"
          style={ctrlChrome}
        />
        <NavigationControl
          position="bottom-right"
          showCompass
          showZoom
          visualizePitch
          style={ctrlChrome}
        />
        <FullscreenControl position="bottom-right" style={ctrlChrome} />

        <Source id="supply-edges" type="geojson" data={edgeGeoJson}>
          <Layer
            id="supply-edge-line"
            type="line"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-opacity': ['get', 'opacity'],
              'line-width': ['get', 'lineWidth'],
            }}
          />
        </Source>

        {sortedMarkers.map((n) => {
          const p = posById.get(n.id);
          if (!p) return null;
          const d = n.data;
          const q = query.trim().toLowerCase();
          const hay = [d.label, d.country, d.hsnCode, d.commodity, d.about]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const searchDim = q.length > 0 && !hay.includes(q);

          const pathOn = !!(pathHighlight?.nodeIds.has(n.id));
          const selected = n.id === selectedId;
          const isRoot = n.id === rootId;

          const baseOpacity = searchDim ? 0.14 : 1;
          const scale =
            selected ? 1.12 : pathOn ? 1.06 : hoveredId === n.id ? 1.04 : 1;

          return (
            <Marker
              key={n.id}
              longitude={p.lng}
              latitude={p.lat}
              anchor="center"
            >
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(n.id);
                }}
                onMouseEnter={() => onHoverNode(n.id)}
                onMouseLeave={() => onHoverNode(null)}
                className="relative flex cursor-pointer flex-col items-center outline-none"
                style={{
                  opacity: baseOpacity,
                  transform: `scale(${scale})`,
                  transition:
                    'transform 0.25s ease, opacity 0.2s ease, box-shadow 0.25s ease',
                }}
                aria-label={`${d.label}, tier ${d.tier}`}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-full blur-md transition-opacity duration-300"
                  style={{
                    background: d.accentColor,
                    opacity: pathOn
                      ? 0.9
                      : selected
                        ? 0.68
                        : isRoot
                          ? 0.52
                          : 0.46,
                  }}
                />
                <span
                  className="relative flex size-[18px] items-center justify-center rounded-full border-[2.5px] shadow-[0_4px_18px_rgba(0,0,0,0.55)] sm:size-5"
                  style={{
                    borderColor: d.accentColor,
                    background: 'linear-gradient(180deg, #1a2230 0%, #0c0e14 100%)',
                    boxShadow: pathOn
                      ? `0 0 26px ${d.accentColor}77, inset 0 0 14px ${d.accentColor}28`
                      : selected
                        ? `0 0 22px ${d.accentColor}55, inset 0 0 10px ${d.accentColor}18`
                        : `0 0 18px ${d.accentColor}44, inset 0 0 8px ${d.accentColor}12`,
                  }}
                >
                  <span
                    className="rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]"
                    style={{
                      width: isRoot ? 9 : 8,
                      height: isRoot ? 9 : 8,
                    }}
                  />
                </span>
                <span className="mt-1.5 max-w-[140px] truncate rounded-md border border-white/10 bg-black/65 px-1.5 py-1 text-[10px] font-semibold leading-tight text-white/95 shadow-sm backdrop-blur-sm sm:max-w-[170px] sm:text-[11px]">
                  {d.label}
                </span>
              </button>
            </Marker>
          );
        })}
      </Mapbox>
    </div>
  );
}

export default function SupplyChainMapView(props: SupplyChainMapViewProps) {
  return <SupplyChainMapViewInner {...props} />;
}
