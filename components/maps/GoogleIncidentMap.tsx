'use client';

// Google Maps version of the incident map (same props as IncidentMap).
// Uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — a browser key restricted to the
// Nucleus domains and the Maps JavaScript API only.
// Markers are custom HTML overlays (OverlayView): triage colour + glow and
// pulsing live headsets, without the deprecated google.maps.Marker or a Map ID.

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { MapInjury, MapHeadset } from '@/components/maps/IncidentMap';

const TRIAGE_COLOR: Record<string, string> = {
  Red: '#f87171', Orange: '#fbbf24', Yellow: '#facc15', Green: '#4ade80',
};

// Google's standard "night" style, toned to Nucleus' palette
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
];

let loaderPromise: Promise<typeof google> | null = null;
function loadGoogleMaps(apiKey: string) {
  if (!loaderPromise) loaderPromise = new Loader({ apiKey, version: 'weekly' }).load();
  return loaderPromise;
}

// HTML marker pinned to a lat/lng
function makeHtmlMarker(g: typeof google, position: google.maps.LatLngLiteral, el: HTMLElement) {
  class HtmlMarker extends g.maps.OverlayView {
    onAdd() { this.getPanes()!.overlayMouseTarget.appendChild(el); }
    draw() {
      const p = this.getProjection().fromLatLngToDivPixel(new g.maps.LatLng(position));
      if (p) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; }
    }
    onRemove() { el.remove(); }
  }
  return new HtmlMarker();
}

const googleMapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

function popupNode(lines: { html: string }[], actions: { label: string; onClick?: () => void; href?: string }[]) {
  const root = document.createElement('div');
  root.style.cssText = 'min-width:190px;font-family:ui-monospace,monospace;color:#0f172a;';
  root.innerHTML = lines.map((l) => l.html).join('');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;font-size:11px;margin-top:8px;';
  actions.forEach((a) => {
    const node = document.createElement(a.href ? 'a' : 'button');
    node.textContent = a.label;
    node.style.cssText = 'color:#0891b2;font-weight:700;cursor:pointer;background:none;border:none;padding:0;text-decoration:none;';
    if (a.href) { (node as HTMLAnchorElement).href = a.href; (node as HTMLAnchorElement).target = '_blank'; (node as HTMLAnchorElement).rel = 'noopener noreferrer'; }
    if (a.onClick) node.addEventListener('click', a.onClick);
    row.appendChild(node);
  });
  root.appendChild(row);
  return root;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export default function GoogleIncidentMap({ injuries, headsets, apiKey }: { injuries: MapInjury[]; headsets: MapHeadset[]; apiKey: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const gRef = useRef<typeof google | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const fitKeyRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !divRef.current) return;
        gRef.current = g;
        mapRef.current = new g.maps.Map(divRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          minZoom: 2,
          styles: DARK_STYLE,
          backgroundColor: '#0b1220',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          // The map fills its panel — scroll should zoom, not ask for Ctrl+scroll
          gestureHandling: 'greedy',
          // Bottom-right is covered by the floating assistant avatar
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER },
        });
        infoRef.current = new g.maps.InfoWindow();
        setReady(true);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    return () => { cancelled = true; };
  }, [apiKey]);

  // (Re)draw markers whenever the data changes
  useEffect(() => {
    const g = gRef.current, map = mapRef.current, info = infoRef.current;
    if (!ready || !g || !map || !info) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    injuries.forEach((inc) => {
      const color = TRIAGE_COLOR[inc.triage] ?? '#22d3ee';
      const glow = inc.triage === 'Red' ? 68 : 48;
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);cursor:pointer;';
      el.innerHTML =
        `<div style="position:absolute;left:50%;top:50%;width:${glow}px;height:${glow}px;margin:-${glow / 2}px 0 0 -${glow / 2}px;border-radius:50%;background:${color};opacity:.18;pointer-events:none"></div>` +
        `<div style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #020617;box-shadow:0 0 8px ${color}"></div>`;
      el.title = `${inc.title} · ${inc.triage}`;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        info.setContent(popupNode(
          [
            { html: `<div style="font-weight:700;font-size:13px;margin-bottom:2px">${esc(inc.title)}</div>` },
            { html: `<div style="font-size:11px;margin-bottom:2px"><span style="color:${color};font-weight:700;filter:brightness(.8)">${esc(inc.triage)}</span> · ${esc(inc.subtitle)}</div>` },
            { html: `<div style="font-size:10px;color:#64748b">${esc(inc.time)} · ${inc.lat.toFixed(5)}, ${inc.lng.toFixed(5)}</div>` },
          ],
          [
            ...(inc.onOpen ? [{ label: 'Open patient →', onClick: () => { info.close(); inc.onOpen!(); } }] : []),
            { label: 'Google Maps ↗', href: googleMapsUrl(inc.lat, inc.lng) },
          ]
        ));
        info.setPosition({ lat: inc.lat, lng: inc.lng });
        info.open({ map });
      });
      const o = makeHtmlMarker(g, { lat: inc.lat, lng: inc.lng }, el);
      o.setMap(map);
      overlaysRef.current.push(o);
    });

    headsets.forEach((h) => {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);cursor:pointer;';
      el.innerHTML = `<div class="nucleus-headset${h.stale ? ' stale' : ''}"><span></span></div>`;
      el.title = `Headset ${h.label}`;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        info.setContent(popupNode(
          [
            { html: `<div style="font-weight:700;font-size:13px;margin-bottom:2px">Headset ${esc(h.label)}</div>` },
            { html: `<div style="font-size:11px;margin-bottom:2px">${h.stale ? 'Last seen' : 'Live'} · updated ${esc(h.updated)}</div>` },
            { html: `<div style="font-size:10px;color:#64748b">${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}</div>` },
          ],
          [{ label: 'Google Maps ↗', href: googleMapsUrl(h.lat, h.lng) }]
        ));
        info.setPosition({ lat: h.lat, lng: h.lng });
        info.open({ map });
      });
      const o = makeHtmlMarker(g, { lat: h.lat, lng: h.lng }, el);
      o.setMap(map);
      overlaysRef.current.push(o);
    });

    // Re-fit only when the set of points changes (not on every refetch)
    const pts = [...injuries.map((i) => ({ lat: i.lat, lng: i.lng })), ...headsets.map((h) => ({ lat: h.lat, lng: h.lng }))];
    const key = pts.map((p) => `${p.lat},${p.lng}`).join('|');
    if (pts.length && key !== fitKeyRef.current) {
      fitKeyRef.current = key;
      if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(15); }
      else {
        const b = new g.maps.LatLngBounds();
        pts.forEach((p) => b.extend(p));
        map.fitBounds(b, 60);
        g.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 0) > 16) map.setZoom(16); });
      }
    }
  }, [ready, injuries, headsets]);

  // Tear down overlays on unmount
  useEffect(() => () => { overlaysRef.current.forEach((o) => o.setMap(null)); }, []);

  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'center', padding: 24 }}>
        Google Maps failed to load ({error}).<br />Check the Maps API key and its allowed websites.
      </div>
    );
  }
  return <div ref={divRef} style={{ width: '100%', height: '100%', background: '#0b1220' }} />;
}
