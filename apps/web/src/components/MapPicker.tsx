import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MapPickerProps {
  lat: number;
  lng: number;
  radius: number;
  onChange: (lat: number, lng: number, radius: number) => void;
  onAddressFound?: (address: string) => void;
  placeholder?: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export function MapPicker({ lat, lng, radius, onChange, onAddressFound, placeholder }: MapPickerProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Address search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setShowDropdown(true);
    setSearchResults([]);

    try {
      // 1. Try our backend geocode endpoint
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/client/geocode?q=${encodeURIComponent(q)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          setSearchResults(data.results);
          setIsSearching(false);
          return;
        }
      }
    } catch {}

    // 2. Fallback to direct OpenStreetMap Nominatim
    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        const mapped = (Array.isArray(data) ? data : []).map((item: any) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          displayName: item.display_name,
        }));
        setSearchResults(mapped);
      }
    } catch (e) {
      console.error('Geocode search failed:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (res: GeocodeResult) => {
    const newLat = Math.round(res.lat * 100000) / 100000;
    const newLng = Math.round(res.lng * 100000) / 100000;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLng], 16, { duration: 0.8 });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([newLat, newLng]);
    }

    onChange(newLat, newLng, radius);
    if (onAddressFound) {
      onAddressFound(res.displayName);
    }
    setShowDropdown(false);
  };

  return (
    <div className="space-y-2.5">
      {/* Address Search Bar */}
      <div ref={searchContainerRef} className="relative z-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder={placeholder || t('admin.searchAddressPlaceholder', 'Поиск по адресу (улица, город)...')}
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition shrink-0 shadow-sm"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{t('admin.searchAddressBtn', 'Найти')}</span>
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800">
            {isSearching ? (
              <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>{t('admin.searchingAddress', 'Поиск по карте...')}</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                {t('admin.noAddressResults', 'Адрес не найден. Попробуйте уточнить название города или улицы.')}
              </div>
            ) : (
              searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left p-2.5 hover:bg-slate-800/80 transition flex items-start gap-2.5 text-xs text-slate-200 group"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition" />
                  <span className="line-clamp-2 leading-relaxed">{item.displayName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Interactive Map */}
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-xl border border-slate-700 overflow-hidden shadow-inner z-0"
      />

      {/* Info footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{t('admin.mapClickHint', 'Кликните на карту или перетащите маркер')}</span>
        <span className="font-mono text-emerald-400">
          {lat.toFixed(5)}, {lng.toFixed(5)} ({radius} {t('admin.metersUnit', 'м')})
        </span>
      </div>
    </div>
  );
}
