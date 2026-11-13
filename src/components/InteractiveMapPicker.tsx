"use client";

import React, { useEffect, useRef, useState } from "react";
import type {
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import {
  MapPin,
  Search,
  Navigation,
  Compass,
  Check,
  ExternalLink,
  Loader2,
  Crosshair,
  Link2,
  AlertCircle,
  X,
} from "lucide-react";

import { buildGoogleMapsUrl, parseCoordinatesFromUrl } from "@/lib/geo";
export { buildGoogleMapsUrl, parseCoordinatesFromUrl };

interface GeocodeCandidate {
  lat: number;
  lng: number;
  label: string;
  shortName: string;
}

interface StatusNotice {
  type: "success" | "error";
  text: string;
}

interface InteractiveMapPickerProps {
  initialUrl?: string;
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (
    lat: number,
    lng: number,
    googleMapsUrl: string,
    suggestedAddress?: string
  ) => void;
  height?: string;
}

const DEFAULT_LAT = -17.3713;
const DEFAULT_LNG = -66.1742;

const PRESETS = [
  { label: "Cochabamba Norte", lat: -17.3713, lng: -66.1742 },
  { label: "Cochabamba Centro", lat: -17.3905, lng: -66.1558 },
  { label: "Cala Cala", lat: -17.3755, lng: -66.16 },
  { label: "La Paz (Centro)", lat: -16.5005, lng: -68.1335 },
  { label: "Santa Cruz (Equipetrol)", lat: -17.768, lng: -63.195 },
];

export default function InteractiveMapPicker({
  initialUrl,
  initialLat,
  initialLng,
  onLocationChange,
  height = "280px",
}: InteractiveMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const initialParsed = parseCoordinatesFromUrl(initialUrl);
  const startLat = initialParsed?.lat ?? initialLat ?? DEFAULT_LAT;
  const startLng = initialParsed?.lng ?? initialLng ?? DEFAULT_LNG;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: startLat,
    lng: startLng,
  });
  const coordsRef = useRef<{ lat: number; lng: number }>({
    lat: startLat,
    lng: startLng,
  });

  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const lastEmittedUrlRef = useRef<string | null>(null);
  const lastExternalUrlRef = useRef<string | undefined>(initialUrl);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeCandidate[]>([]);

  const [mapLinkInput, setMapLinkInput] = useState("");
  const [resolvingLink, setResolvingLink] = useState(false);

  const [geolocating, setGeolocating] = useState(false);
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (type: "success" | "error", text: string, duration = 4500) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ type, text });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const commitPosition = (
    lat: number,
    lng: number,
    options?: {
      recenter?: boolean;
      zoom?: number;
      suggestedAddress?: string;
    }
  ) => {
    coordsRef.current = { lat, lng };
    setCoords({ lat, lng });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (options?.recenter && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], options.zoom ?? 17, {
        animate: true,
      });
    }

    const generatedUrl = buildGoogleMapsUrl(lat, lng);
    lastEmittedUrlRef.current = generatedUrl;
    onLocationChangeRef.current(lat, lng, generatedUrl, options?.suggestedAddress);
  };

  // Initialize Leaflet map once
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let initTimer: ReturnType<typeof setTimeout> | null = null;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const leafletModule = await import("leaflet");
      const L = leafletModule.default ?? leafletModule;

      if (!isMounted || !mapContainerRef.current) return;

      const { lat: initLat, lng: initLng } = coordsRef.current;

      const map = L.map(mapContainerRef.current, {
        center: [initLat, initLng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      const customPinIcon = L.divIcon({
        className: "custom-map-pin-icon",
        html: `<div style="width:36px;height:42px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.35));cursor:grab;">
          <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 27.25 16 40 16 40C16 40 32 27.25 32 16C32 7.163 24.837 0 16 0Z" fill="#E11D48"/>
            <path d="M16 1.5C7.992 1.5 1.5 7.992 1.5 16C1.5 25.95 14.32 37.04 16 38.44C17.68 37.04 30.5 25.95 30.5 16C30.5 7.992 24.008 1.5 16 1.5Z" stroke="#FFFFFF" stroke-width="2.5"/>
            <circle cx="16" cy="15.5" r="5.5" fill="#FFFFFF"/>
          </svg>
        </div>`,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      });

      const marker = L.marker([initLat, initLng], {
        draggable: true,
        icon: customPinIcon,
      }).addTo(map);

      // Map click: move pin in place without forcing panTo or resetting view
      map.on("click", (e: LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        commitPosition(lat, lng);
        showNotice("success", "Pin fijado en el punto seleccionado");
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        commitPosition(pos.lat, pos.lng);
        showNotice("success", "Ubicación del pin actualizada");
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Ensure tiles fill properly when panel mounts inside tabs/accordions
      initTimer = setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 150);

      if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          mapInstanceRef.current?.invalidateSize({ animate: false });
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (initTimer) clearTimeout(initTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sync only genuine external URL changes (e.g. initial load or user editing external input)
  useEffect(() => {
    if (initialUrl === lastEmittedUrlRef.current) return;
    if (initialUrl === lastExternalUrlRef.current) return;
    lastExternalUrlRef.current = initialUrl;

    const ext = parseCoordinatesFromUrl(initialUrl);
    if (!ext) return;

    const cur = coordsRef.current;
    const moved =
      Math.abs(ext.lat - cur.lat) > 0.00001 ||
      Math.abs(ext.lng - cur.lng) > 0.00001;
    if (!moved) return;

    coordsRef.current = ext;
    setCoords(ext);
    if (markerRef.current) {
      markerRef.current.setLatLng([ext.lat, ext.lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([ext.lat, ext.lng], 16, { animate: false });
    }
  }, [initialUrl]);

  // Street / avenue search via server-side geocoder proxy
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      showNotice("error", "Escribe al menos 2 caracteres (ej. Av. América Cochabamba).");
      return;
    }

    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice("error", data?.error || "No se pudo realizar la búsqueda.");
        return;
      }

      const results: GeocodeCandidate[] = Array.isArray(data?.results)
        ? data.results
        : [];
      if (results.length === 0) {
        showNotice(
          "error",
          "Sin resultados. Incluye la ciudad (ej. 'Av. Pando, Cochabamba') o pega tu enlace de Google Maps."
        );
        return;
      }

      setSearchResults(results);
      const best = results[0];
      commitPosition(best.lat, best.lng, {
        recenter: true,
        zoom: 17,
        suggestedAddress: best.shortName || best.label,
      });
      showNotice(
        "success",
        results.length > 1
          ? `Mostrando el primer resultado (${results.length} coincidencias)`
          : `Encontrado: ${best.shortName || best.label}`
      );
    } catch {
      showNotice(
        "error",
        "Error de red al buscar dirección. Puedes hacer clic en el mapa o pegar un link."
      );
    } finally {
      setSearching(false);
    }
  };

  // Resolve direct or shortened Google Maps URL
  const handleResolveMapLink = async () => {
    const raw = mapLinkInput.trim();
    if (!raw) {
      showNotice("error", "Pega un enlace de Google Maps para ubicar el pin.");
      return;
    }

    // Fast client-side extraction if URL already carries coordinates
    const fast = parseCoordinatesFromUrl(raw);
    if (fast) {
      commitPosition(fast.lat, fast.lng, { recenter: true, zoom: 17 });
      showNotice("success", "Ubicación aplicada desde el enlace de Google Maps");
      return;
    }

    setResolvingLink(true);
    try {
      const res = await fetch("/api/admin/resolve-map-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.lat !== "number" || typeof data?.lng !== "number") {
        showNotice(
          "error",
          data?.error ||
            "No pudimos leer coordenadas de ese enlace. Copia el enlace completo desde Google Maps."
        );
        return;
      }

      commitPosition(data.lat, data.lng, {
        recenter: true,
        zoom: 17,
        suggestedAddress: typeof data.label === "string" ? data.label : undefined,
      });
      showNotice("success", "Pin ubicado automáticamente desde Google Maps");
    } catch {
      showNotice("error", "Error de conexión al procesar el enlace de Google Maps.");
    } finally {
      setResolvingLink(false);
    }
  };

  // Device geolocation with high-accuracy -> desktop fallback
  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showNotice("error", "Tu navegador no soporta geolocalización.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      showNotice("error", "La ubicación actual requiere conexión segura HTTPS.");
      return;
    }

    setGeolocating(true);

    const onSuccess = (pos: GeolocationPosition) => {
      setGeolocating(false);
      const { latitude, longitude } = pos.coords;
      commitPosition(latitude, longitude, { recenter: true, zoom: 17 });
      showNotice("success", "Ubicación actual detectada");
    };

    const onFinalError = (err: GeolocationPositionError) => {
      setGeolocating(false);
      if (err.code === 1) {
        showNotice(
          "error",
          "Permiso de ubicación bloqueado. Actívalo en el ícono del candado de tu navegador."
        );
      } else if (err.code === 3) {
        showNotice(
          "error",
          "Tiempo de espera agotado al detectar tu ubicación. Prueba buscar una calle o pegar tu link de Google Maps."
        );
      } else {
        showNotice(
          "error",
          "No se pudo detectar la ubicación del dispositivo. Haz clic en el mapa o pega tu enlace."
        );
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === 1) {
          onFinalError(err);
          return;
        }
        // Fallback for desktops/laptops without hardware GPS
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onFinalError,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Row 1: Street Search + Device Geolocation */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar calle o avenida (ej. Av. América, Cochabamba)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-base sm:text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="min-h-[38px] px-3 py-1.5 bg-[#1F1F23] hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all flex-shrink-0 disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3" />
            )}
            <span>Buscar</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={geolocating}
          className="min-h-[38px] px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-50"
          title="Detectar mi posición actual"
        >
          {geolocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-rose-600" />
          )}
          <span>Mi ubicación actual</span>
        </button>
      </div>

      {/* Search candidates dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-1.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between px-2 py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Resultados encontrados (haz clic para elegir)
            </span>
            <button
              type="button"
              onClick={() => setSearchResults([])}
              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
              title="Cerrar resultados"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {searchResults.map((cand, idx) => {
              const isSelected =
                Math.abs(cand.lat - coords.lat) < 0.0002 &&
                Math.abs(cand.lng - coords.lng) < 0.0002;
              return (
                <button
                  key={`${cand.lat}-${cand.lng}-${idx}`}
                  type="button"
                  onClick={() => {
                    commitPosition(cand.lat, cand.lng, {
                      recenter: true,
                      zoom: 17,
                      suggestedAddress: cand.shortName || cand.label,
                    });
                    setSearchResults([]);
                    showNotice("success", `Ubicado en ${cand.shortName || cand.label}`);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-start gap-2 ${
                    isSelected
                      ? "bg-rose-50 border border-rose-200 text-rose-900"
                      : "hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{cand.shortName}</div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {cand.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 2: Direct Google Maps Link Importer */}
      <div className="flex flex-col sm:flex-row gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-1.5">
        <div className="relative flex-1 min-w-0">
          <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="url"
            placeholder="O pega tu enlace de Google Maps (https://maps.app.goo.gl/... o google.com/maps/...)"
            value={mapLinkInput}
            onChange={(e) => setMapLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleResolveMapLink();
              }
            }}
            className="w-full min-h-[34px] pl-8 pr-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-base sm:text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={handleResolveMapLink}
          disabled={resolvingLink}
          className="min-h-[34px] px-3 py-1 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-50"
        >
          {resolvingLink ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MapPin className="w-3 h-3 text-rose-400" />
          )}
          <span>Usar enlace</span>
        </button>
      </div>

      {/* Inline error / status alert (always clear & truthful) */}
      {notice?.type === "error" && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* Quick Zone Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
          <Compass className="w-3 h-3" /> Referencias:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              commitPosition(preset.lat, preset.lng, { recenter: true, zoom: 16 });
              showNotice("success", `Centrado en ${preset.label}`);
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
          style={{ height, isolation: "isolate" }}
          className="w-full relative z-0 cursor-crosshair"
        />

        {/* Floating Instruction / Success Pill */}
        <div className="absolute top-2 left-12 right-2 pointer-events-none z-20 flex flex-wrap items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F1F23]/90 text-white text-[10px] font-medium shadow-md backdrop-blur-xs">
            <Crosshair className="w-3 h-3 text-rose-400" />
            <span>Haz clic en el mapa o arrastra el pin rojo</span>
          </span>

          {notice?.type === "success" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-md">
              <Check className="w-3 h-3" />
              <span>{notice.text}</span>
            </span>
          )}
        </div>

        {/* Live Coordinates Pill */}
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 text-zinc-800 text-[11px] font-bold border border-zinc-300 shadow-sm backdrop-blur-xs">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>
              Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      {/* Synced Google Maps URL Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
        <div className="flex items-start sm:items-center gap-1.5 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1 sm:mt-0"></span>
          <span className="min-w-0 flex-1 break-all leading-snug">
            Enlace sincronizado:{" "}
            <span className="text-zinc-800 font-bold">
              {buildGoogleMapsUrl(coords.lat, coords.lng)}
            </span>
          </span>
        </div>
        <a
          href={buildGoogleMapsUrl(coords.lat, coords.lng)}
          target="_blank"
          rel="noreferrer"
          className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline sm:ml-2 whitespace-nowrap"
        >
          <span>Probar en Google Maps</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
