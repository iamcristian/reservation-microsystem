"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Search,
  Navigation,
  Compass,
  Check,
  ExternalLink,
  Loader2,
  Crosshair,
} from "lucide-react";

export function parseCoordinatesFromUrl(url?: string | null): { lat: number; lng: number } | null {
  if (!url) return null;
  // Match query=LAT,LNG or q=LAT,LNG
  const queryMatch = url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // Match @LAT,LNG
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

interface InteractiveMapPickerProps {
  initialUrl?: string;
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number, googleMapsUrl: string, suggestedAddress?: string) => void;
  height?: string;
}

export default function InteractiveMapPicker({
  initialUrl,
  initialLat,
  initialLng,
  onLocationChange,
  height = "300px",
}: InteractiveMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize coordinates from URL or defaults (Cochabamba default: -17.3713, -66.1742)
  const parsed = parseCoordinatesFromUrl(initialUrl);
  const defaultLat = parsed?.lat ?? initialLat ?? -17.3713;
  const defaultLng = parsed?.lng ?? initialLng ?? -66.1742;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  // Helper to update location and notify parent
  const updatePosition = (lat: number, lng: number, suggestedAddress?: string) => {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    setCoords({ lat: cleanLat, lng: cleanLng });
    const newUrl = buildGoogleMapsUrl(cleanLat, cleanLng);
    onLocationChange(cleanLat, cleanLng, newUrl, suggestedAddress);

    // Update marker and pan map if instance exists
    if (markerRef.current) {
      markerRef.current.setLatLng([cleanLat, cleanLng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([cleanLat, cleanLng]);
    }
  };

  // Mount Leaflet map once on client
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      // Custom animated SVG pin icon
      const customPinIcon = L.divIcon({
        className: "custom-leaflet-pin",
        html: `
          <div style="position: relative; width: 36px; height: 36px; transform: translate(-18px, -36px); cursor: pointer;">
            <div style="position: absolute; width: 36px; height: 36px; background: #E11D48; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 14px rgba(225, 29, 72, 0.45); border: 2.5px solid #FFFFFF; display: flex; align-items: center; justify-content: center;">
              <div style="width: 12px; height: 12px; background: #FFFFFF; border-radius: 50%; transform: rotate(45deg);"></div>
            </div>
            <div style="position: absolute; bottom: -4px; left: 10px; width: 16px; height: 6px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(1px);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      // Initialize map instance
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      // OpenStreetMap Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // Create draggable marker
      const marker = L.marker([coords.lat, coords.lng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      // On map click -> move marker to clicked coordinate
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        updatePosition(lat, lng);
        setLastActionMessage("📍 Marcador ubicado por clic");
        setTimeout(() => setLastActionMessage(null), 3000);
      });

      // On marker dragend -> update coordinates
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        updatePosition(pos.lat, pos.lng);
        setLastActionMessage("📍 Marcador reubicado");
        setTimeout(() => setLastActionMessage(null), 3000);
      });

      // Ensure proper tile sizing after mount
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map if initialUrl changes externally
  useEffect(() => {
    const ext = parseCoordinatesFromUrl(initialUrl);
    if (ext && (ext.lat !== coords.lat || ext.lng !== coords.lng)) {
      setCoords({ lat: ext.lat, lng: ext.lng });
      if (markerRef.current) markerRef.current.setLatLng([ext.lat, ext.lng]);
      if (mapInstanceRef.current) mapInstanceRef.current.setView([ext.lat, ext.lng], 16);
    }
  }, [initialUrl]);

  // Handle Search using Nominatim Geocoder
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Append country to improve local accuracy if not included
      const queryWithContext = searchQuery.toLowerCase().includes("bolivia")
        ? searchQuery
        : `${searchQuery}, Bolivia`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          queryWithContext
        )}&limit=1`,
        {
          headers: {
            "Accept-Language": "es",
          },
        }
      );
      const data = await res.json().catch(() => []);
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        const displayName = data[0].display_name;

        updatePosition(newLat, newLng, displayName);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 17);
        }
        setLastActionMessage(`Encontrado: ${data[0].name || searchQuery}`);
        setTimeout(() => setLastActionMessage(null), 4000);
      } else {
        setLastActionMessage("No se encontró esa dirección. Intenta hacer clic directamente en el mapa.");
        setTimeout(() => setLastActionMessage(null), 4000);
      }
    } catch {
      setLastActionMessage("Error al buscar dirección. Puedes hacer clic en el mapa.");
      setTimeout(() => setLastActionMessage(null), 3000);
    } finally {
      setSearching(false);
    }
  };

  // Handle Geolocation (Current Device Location)
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada en tu navegador.");
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false);
        const { latitude, longitude } = pos.coords;
        updatePosition(latitude, longitude);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 17);
        }
        setLastActionMessage("📍 Ubicación GPS detectada");
        setTimeout(() => setLastActionMessage(null), 3500);
      },
      () => {
        setGeolocating(false);
        setLastActionMessage("No se pudo obtener la ubicación GPS (permiso denegado o sin señal).");
        setTimeout(() => setLastActionMessage(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Preset quick chips
  const presets = [
    { label: "Cochabamba Norte (Av. Simón López)", lat: -17.3713, lng: -66.1742 },
    { label: "Cochabamba Centro (Plaza Colón)", lat: -17.3905, lng: -66.1558 },
    { label: "Cochabamba Cala Cala", lat: -17.3755, lng: -66.16 },
    { label: "Cochabamba Recoleta", lat: -17.3785, lng: -66.148 },
    { label: "Santa Cruz (Equipetrol)", lat: -17.768, lng: -63.195 },
    { label: "La Paz (Sopocachi)", lat: -16.512, lng: -68.128 },
  ];

  return (
    <div className="space-y-2.5">
      {/* Top Search & GPS Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Escribe calle, plaza o zona (ej. Av. América Cochabamba)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-3 py-1.5 bg-[#1F1F23] hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all flex-shrink-0 disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3" />
            )}
            <span>Buscar</span>
          </button>
        </form>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={geolocating}
          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-50"
          title="Fijar en mi posición GPS actual"
        >
          {geolocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-rose-600" />
          )}
          <span>Mi ubicación actual</span>
        </button>
      </div>

      {/* Quick City & Zone Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <Compass className="w-3 h-3" /> Zonas:
        </span>
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              updatePosition(preset.lat, preset.lng);
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([preset.lat, preset.lng], 16);
              }
              setLastActionMessage(`📍 Ubicado en ${preset.label}`);
              setTimeout(() => setLastActionMessage(null), 3000);
            }}
            className="px-2.5 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 rounded-full text-[10px] font-medium transition-all flex-shrink-0"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative rounded-2xl border border-zinc-300 overflow-hidden shadow-inner bg-zinc-100">
        <div
          ref={mapContainerRef}
          style={{ height }}
          className="w-full z-0 cursor-crosshair"
        />

        {/* Floating Instruction Banner */}
        <div className="absolute top-2 left-2 right-2 pointer-events-none z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F1F23]/90 text-white text-[10px] font-medium shadow-md backdrop-blur-xs">
            <Crosshair className="w-3 h-3 text-rose-400" />
            <span>Haz clic en el mapa o arrastra el pin rojo</span>
          </span>

          {lastActionMessage && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-md animate-fade-in">
              <Check className="w-3 h-3" />
              <span>{lastActionMessage}</span>
            </span>
          )}
        </div>

        {/* Live Coordinates Pill on Map */}
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 text-zinc-800 text-[11px] font-bold border border-zinc-300 shadow-sm backdrop-blur-xs">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>
              Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      {/* Google Maps link sync badge */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
          <span className="truncate">
            Enlace sincronizado: <b className="text-zinc-800">{buildGoogleMapsUrl(coords.lat, coords.lng)}</b>
          </span>
        </div>
        <a
          href={buildGoogleMapsUrl(coords.lat, coords.lng)}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-2"
        >
          <span>Probar en Google Maps</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
