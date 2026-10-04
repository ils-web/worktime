import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPickerProps {
  lat: number;
  lng: number;
  radius: number;
  onChange: (lat: number, lng: number, radius: number) => void;
}

export function MapPicker({ lat, lng, radius, onChange }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix standard Leaflet default icon issues in Webpack/Vite
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const initialLat = lat || 32.0853;
    const initialLng = lng || 34.7818;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    const circle = L.circle([initialLat, initialLng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.25,
      radius: radius || 100,
    }).addTo(map);
    circleRef.current = circle;

    // On marker drag
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
      onChange(Math.round(pos.lat * 100000) / 100000, Math.round(pos.lng * 100000) / 100000, radius);
    });

    // On map click
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
      onChange(Math.round(e.latlng.lat * 100000) / 100000, Math.round(e.latlng.lng * 100000) / 100000, radius);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update circle radius when radius prop changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Update map view when lat/lng change from outside
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
        markerRef.current.setLatLng([lat, lng]);
        circleRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng]);
      }
    }
  }, [lat, lng]);

  return (
    <div className="space-y-3">
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-xl border border-slate-700 overflow-hidden shadow-inner z-0"
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Кликните на карту или перетащите маркер</span>
        <span className="font-mono text-emerald-400">
          {lat.toFixed(5)}, {lng.toFixed(5)} ({radius} м)
        </span>
      </div>
    </div>
  );
}
