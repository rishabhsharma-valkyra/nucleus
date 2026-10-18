'use client';

// Leaflet map of real wound-scan locations and live headset positions.
// Client-only (Leaflet touches window) — load it with next/dynamic, ssr:false.
// Tiles: Esri World Dark Gray Canvas (base + labels) — no API key needed.

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';

export interface MapInjury {
  id: string;
  lat: number;
  lng: number;
  triage: string;
  title: string;      // patient name
  subtitle: string;   // body region · PWAT
  time: string;       // formatted
  onOpen?: () => void;
}

export interface MapHeadset {
  id: string;
  lat: number;
  lng: number;
  label: string;      // device id / patient
  updated: string;    // formatted "x min ago"
  stale: boolean;     // no update for a while
}

const TRIAGE_COLOR: Record<string, string> = {
  Red: '#f87171', Orange: '#fbbf24', Yellow: '#facc15', Green: '#4ade80',
};

const headsetIcon = (stale: boolean) => L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div class="nucleus-headset${stale ? ' stale' : ''}"><span></span></div>`,
});

// Re-fit the view whenever the set of plotted points changes.
function FitToPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

const googleMapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

export default function IncidentMap({ injuries, headsets }: { injuries: MapInjury[]; headsets: MapHeadset[] }) {
  const points = useMemo<[number, number][]>(
    () => [...injuries.map((i) => [i.lat, i.lng] as [number, number]), ...headsets.map((h) => [h.lat, h.lng] as [number, number])],
    [injuries, headsets]
  );

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={16}
      worldCopyJump
      style={{ width: '100%', height: '100%', background: '#0b1220' }}
      attributionControl
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <FitToPoints points={points} />

      {/* Heat glow first so every marker sits on top of all glows */}
      {injuries.map((inc) => (
        <CircleMarker
          key={`glow-${inc.id}`}
          center={[inc.lat, inc.lng]}
          radius={inc.triage === 'Red' ? 34 : 24}
          pathOptions={{ stroke: false, fillColor: TRIAGE_COLOR[inc.triage] ?? '#22d3ee', fillOpacity: 0.16 }}
          interactive={false}
        />
      ))}

      {injuries.map((inc) => (
        <CircleMarker
          key={inc.id}
          center={[inc.lat, inc.lng]}
          radius={7}
          pathOptions={{ color: '#020617', weight: 2, fillColor: TRIAGE_COLOR[inc.triage] ?? '#22d3ee', fillOpacity: 1 }}
        >
          <Popup>
            <div style={{ minWidth: 190, fontFamily: 'ui-monospace, monospace' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{inc.title}</div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: TRIAGE_COLOR[inc.triage] ?? '#94a3b8', fontWeight: 700 }}>{inc.triage}</span> · {inc.subtitle}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>{inc.time} · {inc.lat.toFixed(5)}, {inc.lng.toFixed(5)}</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                {inc.onOpen && (
                  <button onClick={inc.onOpen} style={{ color: '#0891b2', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                    Open patient →
                  </button>
                )}
                <a href={googleMapsUrl(inc.lat, inc.lng)} target="_blank" rel="noopener noreferrer" style={{ color: '#0891b2' }}>Google Maps ↗</a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {headsets.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]} icon={headsetIcon(h.stale)}>
          <Popup>
            <div style={{ minWidth: 180, fontFamily: 'ui-monospace, monospace' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Headset {h.label}</div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>{h.stale ? 'Last seen' : 'Live'} · updated {h.updated}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</div>
              <a href={googleMapsUrl(h.lat, h.lng)} target="_blank" rel="noopener noreferrer" style={{ color: '#0891b2', fontSize: 11 }}>Google Maps ↗</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
