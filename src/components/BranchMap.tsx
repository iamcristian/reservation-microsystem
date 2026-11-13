"use client";

import React, { useState } from "react";
import { MapPin, Navigation, Copy, Check } from "lucide-react";
import { parseCoordinatesFromUrl } from "./InteractiveMapPicker";

interface BranchMapProps {
  name?: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  googleMapsUrl?: string;
  height?: string;
  compact?: boolean;
  className?: string;
}

export default function BranchMap({
  name = "Clínica & Reservas",
  addressText = "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia",
  lat: propLat,
  lng: propLng,
  googleMapsUrl,
  height = "260px",
  compact = false,
  className = "",
}: BranchMapProps) {
  const [copied, setCopied] = useState(false);

  // Extract real coordinates dynamically from googleMapsUrl if present
  const parsedCoords = parseCoordinatesFromUrl(googleMapsUrl);
  const lat = parsedCoords?.lat ?? (propLat ?? -17.3713);
  const lng = parsedCoords?.lng ?? (propLng ?? -66.1742);

  // Open exact location pin without calculating route or directions
  const exactMapsUrl =
    googleMapsUrl && googleMapsUrl.trim().length > 5 && !googleMapsUrl.includes("/dir/")
      ? googleMapsUrl
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Bounding box calculated for street level zoom in Cochabamba (Av. Simón López & Beijing)
  const minLon = (lng - 0.008).toFixed(4);
  const maxLon = (lng + 0.008).toFixed(4);
  const minLat = (lat - 0.007).toFixed(4);
  const maxLat = (lat + 0.007).toFixed(4);

  const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(addressText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-sm ${className}`}
    >
      {/* Header Info Bar */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-100 font-bold text-xs">
              <MapPin className="w-4 h-4 text-rose-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#1F1F23] truncate">
                {name}
              </div>
              <div className="text-[11px] text-zinc-500 truncate">
                {addressText}
              </div>
            </div>
          </div>

          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Cochabamba
          </span>
        </div>
      )}

      {/* Map Canvas (Oficial OpenStreetMap Responsive Embed) */}
      <div className="relative w-full bg-zinc-100" style={{ height }}>
        <iframe
          title="Mapa de Ubicación"
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          scrolling="no"
          src={iframeSrc}
          loading="lazy"
        />

        {/* Floating marker notice pill */}
        <div className="absolute top-2 left-2 right-12 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-white/95 text-zinc-800 font-bold border border-zinc-200 shadow-sm backdrop-blur-xs max-w-full">
            <span className="text-rose-600 shrink-0">📍</span>
            <span className="truncate">{addressText || name}</span>
          </span>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="p-2.5 bg-white border-t border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <a
          href={exactMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-h-[40px] py-2 px-3 rounded-full bg-[#1F1F23] text-white text-xs font-semibold hover:bg-black transition-all flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        >
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Abrir en Google Maps</span>
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[40px] py-2 px-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[#1F1F23] text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-zinc-200/60 whitespace-nowrap"
          title="Copiar dirección"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">¡Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-600" />
              <span>Copiar dirección</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
